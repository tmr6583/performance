from olist_auth import OlistAuth, OlistClient
import json
c = OlistClient(OlistAuth())
try:
    print(json.dumps(c.api_get('pedidos/928110110'), indent=2))
except Exception as e:
    print(e)