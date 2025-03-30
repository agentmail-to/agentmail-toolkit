#!/usr/bin/env python3
import os
import sys
import importlib.util

print(f"Python version: {sys.version}")
print(f"Working directory: {os.getcwd()}")
print(f"Script location: {os.path.abspath(__file__)}")
print(f"Python path: {sys.path}")

# Try direct import
try:
    from tools import email
    print("✅ Successfully imported 'tools.email'")
    print(f"  Module location: {os.path.abspath(email.__file__)}")
    
    # Check what's in the module
    print(f"  Module has these attributes: {dir(email)}")
    
    # Check for key functions
    if hasattr(email, 'register_tools'):
        print("  ✅ 'register_tools' function exists")
    else:
        print("  ❌ 'register_tools' function is missing")
        
except Exception as e:
    print(f"❌ Failed to import 'tools.email': {e}")
    
    # Try to find the tools directory
    current_dir = os.path.dirname(os.path.abspath(__file__))
    tools_dir = os.path.join(current_dir, 'tools')
    
    if os.path.exists(tools_dir):
        print(f"✅ Tools directory exists at: {tools_dir}")
        print(f"  Contents: {os.listdir(tools_dir)}")
        
        # Check if email.py exists
        email_path = os.path.join(tools_dir, 'email.py')
        if os.path.exists(email_path):
            print(f"✅ email.py file exists at: {email_path}")
            
            # Try to load it directly
            try:
                spec = importlib.util.spec_from_file_location("email", email_path)
                email_module = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(email_module)
                print("✅ Successfully loaded email.py directly")
                print(f"  Module has these attributes: {dir(email_module)}")
            except Exception as e:
                print(f"❌ Failed to load email.py directly: {e}")
        else:
            print(f"❌ email.py file does not exist at: {email_path}")
    else:
        print(f"❌ Tools directory does not exist at: {tools_dir}")
        
        # List all directories to find tools
        for root, dirs, files in os.walk(current_dir):
            if 'tools' in dirs:
                tools_path = os.path.join(root, 'tools')
                print(f"Found tools directory at: {tools_path}")
                print(f"  Contents: {os.listdir(tools_path)}")