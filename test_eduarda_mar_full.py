import json
from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
try:
    p = c.api_get('pedidos/927982825')
    print(json.dumps(p, indent=2))
except Exception as e:
    print(e)
