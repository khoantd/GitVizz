# Repository Code Context
Found 2 relevant code components:

## Summary
Components: 1 class, 1 function

## 📁 adithya-s-k-omniparse-9d1ae83/omniparse/demo.py
### 1. Function: `parse_document`
**Details**: Lines 179-217 | 13 connections
**Code:**
```python
def parse_document(input_file_path, parameters, request: gr.Request):
    allowed_extensions = ['.pdf', '.ppt', '.pptx', '.doc', '.docx']
    file_extension = os.path.splitext(input_file_path)[1].lower()
    if file_extension not in allowed_extensions:
        raise gr.Error(f'File type not supporte
# ... (truncated)
```

## 📁 adithya-s-k-omniparse-9d1ae83/python-sdk/omniparse_client/utils.py
### 1. Class: `ParsedDocument`
**Details**: Lines 77-150 | 4 connections
**Code:**
```python
class ParsedDocument(BaseModel):
    """
    Represents a parsed document with its content and associated data.

    Attributes:
        markdown (str): The document content in markdown format.
        images (Optional[List[ImageObj]|dict]): Images extracted from the document.
        tables (Option
# ... (truncated)
```
