import os
from google.oauth2 import service_account
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request

SCOPES = [
    'https://www.googleapis.com/auth/drive',
    'https://www.googleapis.com/auth/documents'
]

def connect_to_google_api(credentials_path):
    """Initializes and returns the Docs and Drive services."""
    creds = service_account.Credentials.from_service_account_file(
        credentials_path, scopes=SCOPES
    )
    docs_service = build('docs', 'v1', credentials=creds)
    drive_service = build('drive', 'v3', credentials=creds)
    return docs_service, drive_service

def connect_to_google_api_personal():
    creds = None
    # 1. The code looks for token.json (your saved session)
    if os.path.exists('token.json'):
        creds = Credentials.from_authorized_user_file('token.json', SCOPES)
    
    # 2. If no valid session, start the login process
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            # IMPORTANT: This must point to the file you downloaded from Google
            if not os.path.exists('client_secrets.json'):
                raise FileNotFoundError("Put your downloaded JSON as 'client_secrets.json' in this folder.")
            
            flow = InstalledAppFlow.from_client_secrets_file('client_secrets.json', SCOPES)
            creds = flow.run_local_server(port=0)
        
        # 3. Save the session to token.json for next time
        with open('token.json', 'w') as token:
            token.write(creds.to_json())

    return build('docs', 'v1', credentials=creds), build('drive', 'v3', credentials=creds)

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