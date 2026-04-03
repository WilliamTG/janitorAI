import os
from fastapi import FastAPI
from pydantic import BaseModel
from main import create_report
from google_api import connect_to_google_api_personal, download_knowledge_from_drive

app = FastAPI()

class DemoRequest(BaseModel):
    video_filename: str

# Definer stier
RENDER_TOKEN_PATH = "/etc/secrets/token.json"
LOCAL_TOKEN_PATH = "token.json"
TEMP_KNOWLEDGE_DIR = "./temp_knowledge"

@app.post("/api/demo-report")
async def run_demo_analysis(request: DemoRequest):
    # 1. Velg riktig token-path
    token_path = RENDER_TOKEN_PATH if os.path.exists(RENDER_TOKEN_PATH) else LOCAL_TOKEN_PATH
    print(f"🔑 Bruker token fra: {token_path}")

    # 2. Koble til Google og last ned kunnskap fra Drive
    # Vi gjør dette inni her så vi alltid har fersk kunnskap
    docs_service, drive_service = connect_to_google_api_personal(token_path)
    
    knowledge_id = os.getenv("KNOWLEDGE_FOLDER")
    if knowledge_id:
        download_knowledge_from_drive(drive_service, knowledge_id, TEMP_KNOWLEDGE_DIR)
    
    # 3. Trigger analysen i main.py
    video_path = os.path.join(os.path.dirname(__file__), request.video_filename)
    
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