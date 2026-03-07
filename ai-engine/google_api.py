from google.oauth2 import service_account
from googleapiclient.discovery import build

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

def export_doc_as_pdf(drive_service, doc_id):
    """Downloads the Google Doc as a PDF buffer."""
    return drive_service.files().export(
        fileId=doc_id, 
        mimeType='application/pdf'
    ).execute()