# Repository Code Context
Found 2 relevant code components:

## Summary
Components: 2 functions

## 📁 adithya-s-k-omniparse-9d1ae83/download.py
### 1. Function: `download_models`
**Details**: Lines 9-17 | 8 connections
**Code:**
```python
def download_models():
    parser = argparse.ArgumentParser(description='Download models for omniparse')
    parser.add_argument('--documents', action='store_true', help='Load document models')
    parser.add_argument('--media', action='store_true', help='Load media models')
    parser.add_argument(
# ... (truncated)
```

## 📁 adithya-s-k-omniparse-9d1ae83/omniparse/web/model_loader.py
### 1. Function: `download_all_models`
**Details**: Lines 242-268 | 10 connections
**Code:**
```python
def download_all_models(remove_existing=False):
    """Download all models required for OmniParse."""
    if remove_existing:
        print('[LOG] Removing existing models...')
        home_folder = get_home_folder()
        model_folders = [os.path.join(home_folder, 'models/reuters'), os.path.join(
# ... (truncated)
```
