from googleapiclient.http import MediaFileUpload

def replace_text_in_doc(docs_service, doc_id, replacements):
    """Executes a batch update to replace multiple placeholders."""
    requests = []
    for key, value in replacements.items():
        requests.append({
            'replaceAllText': {
                'containsText': {'text': key, 'matchCase': True},
                'replaceText': str(value) if value else "—"
            }
        })
    return docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': requests}).execute()

def find_placeholder_index(docs_service, doc_id, placeholder):
    """Deep searches the doc (including tables) for a placeholder's index."""
    doc = docs_service.documents().get(documentId=doc_id).execute()
    for content in doc.get('body').get('content'):
        # Check standard paragraphs
        if 'paragraph' in content:
            for element in content.get('paragraph').get('elements'):
                text_run = element.get('textRun')
                if text_run and placeholder in text_run.get('content'):
                    return element.get('startIndex')
        # Check tables (where your images usually go)
        if 'table' in content:
            for row in content.get('table').get('tableRows'):
                for cell in row.get('tableCells'):
                    for cell_content in cell.get('content'):
                        if 'paragraph' in cell_content:
                            for element in cell_content.get('paragraph').get('elements'):
                                text_run = element.get('textRun')
                                if text_run and placeholder in text_run.get('content'):
                                    return element.get('startIndex')
    return None

def upload_and_insert_image(drive_service, docs_service, doc_id, image_path, placeholder, folder_id):
    """Uploads image to Drive, makes it public, and inserts it into the Doc."""
    # 1. Upload to Drive
    media = MediaFileUpload(image_path, mimetype='image/jpeg')
    file_metadata = {'name': 'evidence_frame.jpg', 'parents': [folder_id]}
    file = drive_service.files().create(body=file_metadata, media_body=media, fields='id, thumbnailLink').execute()
    
    # 2. Set Public Permissions (Required for Docs API to 'fetch' the image)
    drive_service.permissions().create(fileId=file['id'], body={'type': 'anyone', 'role': 'reader'}).execute()
    image_url = file.get('thumbnailLink').replace('=s220', '=s1000')

    # 3. Find index and swap text for image
    idx = find_placeholder_index(docs_service, doc_id, placeholder)
    if idx:
        requests = [
            {'deleteContentRange': {'range': {'startIndex': idx, 'endIndex': idx + len(placeholder)}}},
            {'insertInlineImage': {
                'uri': image_url, 
                'location': {'index': idx}, 
                'objectSize': {'width': {'magnitude': 400, 'unit': 'PT'}}
            }}
        ]
        docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': requests}).execute()