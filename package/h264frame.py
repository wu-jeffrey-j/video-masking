import os
import io
import av
import sys
import struct

bucket = None


# Get screenshot from local insv
# Can be modified to get screenshots from other places like s3, keep the interface consistent
class LocalClient:
    def __init__(self):
        pass

    # Returns the data within the Range of the bucket's key
    # Range format is a string: L-R
    # Represents the range [L, R]
    def get_object(self, bucket, key, Range):
        Range = Range[Range.find("=") + 1 :].split("-")
        Range = (int(Range[0]), int(Range[1]) + 1)
        fp = open(key, "rb")
        fp.seek(Range[0], 0)
        ret = fp.read(Range[1] - Range[0])
        fp.close()
        return ret

    # Get the list under a certain prefix directory
    def list_objects(self, Bucket, Prefix, MaxKeys):
        ret = []
        for root, _, files in os.walk(Prefix):
            for f in files:
                ret.append(os.path.join(root, f))
        ret = [{"Key": x} for x in ret]
        ret = {"Contents": ret}
        return ret


client = LocalClient()


def getData(key, off, size):
    data = client.get_object(bucket, key, Range=f"bytes={off}-{off+size-1}")
    assert len(data) == size
    return data


def findBox(key, target, startPos, endPos=None):
    while endPos is None or startPos + 8 < endPos:
        data = getData(key, startPos, 8)
        size = struct.unpack(">I", data[:4])[0]
        if size == 1:
            tmp = getData(key, startPos + 8, 8)
            size = struct.unpack(">Q", tmp)[0]
        if data[4:] == target:
            return (startPos, size)
        startPos += size
    return None


def findBoxData(data, targets):
    if not targets:
        return data
    pos = 0
    while pos + 8 < len(data):
        size = struct.unpack(">I", data[pos : pos + 4])[0]
        flag = data[pos + 4 : pos + 8]
        assert size > 0
        if flag == targets[0]:
            return findBoxData(data[pos + 8 : pos + size], targets[1:])
        pos += size
    return None


def parseIntList(data):
    return [struct.unpack(">I", data[i : i + 4])[0] for i in range(0, len(data), 4)]


def parseLongList(data):
    return [struct.unpack(">Q", data[i : i + 8])[0] for i in range(0, len(data), 8)]


def toImage(data, name):
    buf = io.BytesIO()
    buf.write(data)
    container = av.open(buf, format="hevc")
    for packet in container.demux(video=0):
        for frame in packet.decode():
            img = frame.to_image()  # PIL.Image in RGB
            # Change the actual size of the stored image
            img = img.resize((640, 640))
            img.save(f"{name}", "JPEG")


def solveHVCC(data):
    num = data[0]
    data = data[1:]
    ret = []
    while data:
        t = data[0]
        num = struct.unpack(">H", data[1:3])[0]
        assert num == 1
        size = struct.unpack(">H", data[3:5])[0]
        ans = data[5 : 5 + size]
        ret.append(ans)
        data = data[5 + size :]
    return ret


def addAnnex(data):
    ans = []
    while data:
        size = struct.unpack(">I", data[:4])[0]
        data = data[4:]
        assert len(data) >= size
        ans.append(data[:size])
        data = data[size:]
    return ans


def solveMp4(key, dir_path):
    print("SOLVE:", key)
    sys.stdout.flush()
    moovPos = findBox(key, b"moov", 0)
    assert moovPos is not None
    trakPoses = []
    rem = moovPos
    while 1:
        trakPos = findBox(key, b"trak", rem[0] + 8, moovPos[0] + moovPos[1])
        if trakPos is None:
            break
        trakPoses.append(trakPos)
        rem = trakPos
    name = key.replace("/", "__")
    name = name.replace("\\", "__")
    name = name.replace(":", "")
    for trackIdx, trakPos in enumerate(trakPoses):
        data = getData(key, trakPos[0], trakPos[1])[8:]
        data = findBoxData(data, [b"mdia", b"minf", b"stbl"])
        assert data is not None
        hvc1 = findBoxData(findBoxData(data, [b"stsd"])[8:], [b"hvc1"])
        if hvc1 is None:
            continue
        hvcC = findBoxData(hvc1[78:], [b"hvcC"])
        nalus = solveHVCC(hvcC[22:])
        stss = findBoxData(data, [b"stss"])
        if stss is None:
            continue
        stss = parseIntList(stss)[1:]
        assert stss[0] == len(stss) - 1
        stss = stss[1:]
        stsz = findBoxData(data, [b"stsz"])
        assert stsz is not None
        stsz = parseIntList(stsz)[2:]
        assert stsz[0] == len(stsz) - 1
        stsz = stsz[1:]
        stco = findBoxData(data, [b"stco"])
        if stco is None:
            stco = findBoxData(data, [b"co64"])
            assert stco is not None
            stco = parseLongList(stco)
        else:
            stco = parseIntList(stco)[1:]
        assert stco[0] == len(stco) - 1
        stco = stco[1:]
        idx = stss[len(stss) // 2] - 1
        framePos = (stco[idx], stsz[idx])
        data = getData(key, framePos[0], framePos[1])
        data = nalus + addAnnex(data)
        data = [b"\x00\x00\x00\x01" + one for one in data]
        data = b"".join(data)
        toImage(data, f"{dir_path}/{name}.{idx+1}.{trackIdx}.jpg")
        sys.stdout.flush()
