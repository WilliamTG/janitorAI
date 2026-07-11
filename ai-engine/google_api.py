import os
import json
from google.oauth2 import service_account
from googleapiclient.discovery import build

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents'
]

def connect_to_google_api(credentials_path):
    """Initializes Docs and Drive services from a service account file on disk."""
    creds = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=SCOPES
    )
    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    return docs_service, drive_service

def connect_to_google_api_personal():
    """
    Initializes Docs and Drive services using a Google Service Account.

    Credentials are loaded from (in priority order):
    1. Render Secret File at /etc/secrets/service_account.json
    2. Environment variable 'service_account.json' (full JSON string)
    """
    sa_json = None

    # 1. Render Secret File (preferred — Render stores secret files here)
    secret_file_path = "/etc/secrets/service_account.json"
    if os.path.exists(secret_file_path):
        with open(secret_file_path, "r") as f:
            sa_json = f.read().strip()

    # 2. Fall back to environment variable (full JSON as string)
    if not sa_json:
        sa_json = os.environ.get("service_account.json")

    if not sa_json:
        raise EnvironmentError(
            "Missing required secret 'service_account.json'. "
            "Add it as a Render Secret File or as an environment variable "
            "containing the full Google Service Account credentials JSON."
        )

    info = json.loads(sa_json)
    creds = service_account.Credentials.from_service_account_info(info, scopes=SCOPES)

    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    return docs_service, drive_service

def export_doc_as_pdf(drive_service, doc_id):
    """Downloads the Google Doc as a PDF buffer."""
    return drive_service.files().export(
        fileId=doc_id, 
        mimeType='application/pdf'
    ).execute()

def upload_knowledge_base(genai_client, folder_path):
    uploaded_files = []
    for filename in os.listdir(folder_path):
        if filename.endswith(".pdf"):
            print(f"📚 Uploading knowledge: {filename}")
            path = os.path.join(folder_path, filename)
            file = genai_client.files.upload(file=path)
            uploaded_files.append(file)
    return uploaded_files

def download_knowledge_from_drive(drive_service, folder_id, local_path):
    if not os.path.exists(local_path):
        os.makedirs(local_path)

    results = drive_service.files().list(
        q=f"'{folder_id}' in parents and mimeType='application/pdf'",
        fields="files(id, name)"
    ).execute()

    files = results.get('files', [])
    for file in files:
        file_id = file['id']
        filename = file['name']

        request = drive_service.files().get_media(fileId=file_id)
        with open(os.path.join(local_path, filename), 'wb') as f:
            f.write(request.execute())

def download_video_from_drive(drive_service, folder_id, video_filename, local_dir):
    """
    Downloads a specific video file from Google Drive folder to local directory.
    Returns the local path if successful, raises exception if file not found.
    """
    if not os.path.exists(local_dir):
        os.makedirs(local_dir)

    local_path = os.path.join(local_dir, video_filename)

    # If file already exists locally, skip download
    if os.path.exists(local_path):
        print(f"✅ Video allerede lastet ned: {local_path}")
        return local_path

    # Search for the video file in the Drive folder
    print(f"🔍 Søker etter '{video_filename}' i Google Drive folder {folder_id}...")
    results = drive_service.files().list(
        q=f"'{folder_id}' in parents and name='{video_filename}'",
        fields="files(id, name, mimeType)"
    ).execute()

    files = results.get('files', [])

    if not files:
        raise FileNotFoundError(f"Fant ikke filen '{video_filename}' i Google Drive folder {folder_id}")

    file_id = files[0]['id']
    filename = files[0]['name']

    print(f"📥 Laster ned '{filename}' fra Google Drive...")
    request = drive_service.files().get_media(fileId=file_id)

    with open(local_path, 'wb') as f:
        f.write(request.execute())

    print(f"✅ Video lastet ned til: {local_path}")
    return local_path