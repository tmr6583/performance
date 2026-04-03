from olist_auth import OlistAuth, OlistClient
c = OlistClient(OlistAuth())
print("Order 1641:", c.api_get('pedidos/928110110').get('situacao'))