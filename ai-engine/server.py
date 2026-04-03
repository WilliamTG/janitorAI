import os
from fastapi import FastAPI
from pydantic import BaseModel
from main import create_report
from google_api import connect_to_google_api_personal, download_knowledge_from_drive

app = FastAPI()

class DemoRequest(BaseModel):
    video_filename: str

# Stier på serveren
RENDER_TOKEN_PATH = "/etc/secrets/token.json"
LOCAL_TOKEN_PATH = "token.json"
TEMP_KNOWLEDGE_DIR = "./temp_knowledge"
TEMP_VIDEO_DIR = "./videos"

@app.post("/api/demo-report")
async def run_demo_analysis(request: DemoRequest):
    token_path = RENDER_TOKEN_PATH if os.path.exists(RENDER_TOKEN_PATH) else LOCAL_TOKEN_PATH
    docs_service, drive_service = connect_to_google_api_personal(token_path)
    
    # 1. Last ned Byggforsk-kunnskap (PDF-er)
    knowledge_id = os.getenv("KNOWLEDGE_FOLDER")
    if knowledge_id:
        download_knowledge_from_drive(drive_service, knowledge_id, TEMP_KNOWLEDGE_DIR)
    
    # 2. Last ned Demo-videoen fra den NYE mappen
    video_folder_id = os.getenv("VIDEO_FOLDER") # Din nye variabel
    video_path = os.path.join(TEMP_VIDEO_DIR, request.video_filename)
    
    if not os.path.exists(video_path):
        print(f"🎥 Video mangler. Henter {request.video_filename} fra VIDEO_FOLDER...")
        # Vi bruker samme funksjon, men sender inn video_folder_id og TEMP_VIDEO_DIR
        download_knowledge_from_drive(drive_service, video_folder_id, TEMP_VIDEO_DIR)

    # 3. Kjør analysen
    try:
        report_url = create_report(
            video_path=video_path,
            credentials_path=token_path,
            master_id=os.getenv("MASTER_ID"),
            output_folder=os.getenv("OUTPUT_FOLDER"),
            gemini_key=os.getenv("GEMINI_API_KEY")
        )
        return {"status": "success", "url": report_url}
    except Exception as e:
        return {"status": "error", "message": str(e)}