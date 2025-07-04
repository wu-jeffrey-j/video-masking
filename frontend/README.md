# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

## Run Locally

**Prerequisites:** Node.js and Python

1.  **Install Frontend Dependencies**:
    `npm install`

2.  **Install Backend Dependencies**:
    `pip install -r ../backend/requirements.txt`

3.  **Run the Backend Server**:
    `python ../backend/api.py`

4.  **Run the Frontend App**:
    `npm run dev`

The frontend will be available at `http://localhost:5173` and will connect to the backend server running at `http://localhost:8000`.
