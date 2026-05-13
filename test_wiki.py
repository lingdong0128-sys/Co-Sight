import os
import requests

proxy = os.environ.get("PROXY")
print("PROXY:", proxy)
print("HTTP_PROXY:", os.environ.get("HTTP_PROXY"))
