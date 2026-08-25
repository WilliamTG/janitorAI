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

def upload_image_to_drive(drive_service, image_path, folder_id, name='evidence_frame.jpg'):
    """Uploads an image to Drive, makes it public, returns a Docs-fetchable URL."""
    media = MediaFileUpload(image_path, mimetype='image/jpeg')
    file_metadata = {'name': name, 'parents': [folder_id]}
    file = drive_service.files().create(body=file_metadata, media_body=media, fields='id, thumbnailLink').execute()

    # Public permission is required for the Docs API to 'fetch' the image.
    drive_service.permissions().create(fileId=file['id'], body={'type': 'anyone', 'role': 'reader'}).execute()
    return file.get('thumbnailLink').replace('=s220', '=s1000')


def upload_and_insert_image(drive_service, docs_service, doc_id, image_path, placeholder, folder_id):
    """Uploads image to Drive, makes it public, and inserts it into the Doc."""
    image_url = upload_image_to_drive(drive_service, image_path, folder_id)

    # Find index and swap text for image
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


def insert_photo_gallery(drive_service, docs_service, doc_id, photos, anchor_text, folder_id):
    """
    Inserts every inspector photo under the paragraph containing anchor_text
    (e.g. «Bilder av stedet»), each on its own line with an optional label.

    photos: list of dicts {'path': str, 'label': str|None}, in capture order.
    Indices are computed with running offsets so everything lands in ONE
    batchUpdate: insertText adds len(text) index units, an inline image adds 1.
    Silently does nothing when the anchor is missing (template variant).
    """
    if not photos:
        return

    anchor_idx = find_placeholder_index(docs_service, doc_id, anchor_text)
    if anchor_idx is None:
        print(f"⚠️  Fant ikke seksjonen {anchor_text!r} i malen — hopper over bildegalleri")
        return

    # Insertion starts right after the anchor paragraph's trailing newline.
    loc = anchor_idx + len(anchor_text) + 1
    requests = []
    for i, photo in enumerate(photos, 1):
        url = upload_image_to_drive(drive_service, photo['path'], folder_id,
                                    name=f'inspeksjonsfoto_{i}.jpg')
        label = (photo.get('label') or '').strip()
        text = f"\n{label}\n" if label else "\n"
        requests.append({'insertText': {'location': {'index': loc}, 'text': text}})
        loc += len(text)
        requests.append({'insertInlineImage': {
            'uri': url,
            'location': {'index': loc},
            'objectSize': {'width': {'magnitude': 320, 'unit': 'PT'}},
        }})
        loc += 1

    docs_service.documents().batchUpdate(documentId=doc_id, body={'requests': requests}).execute()