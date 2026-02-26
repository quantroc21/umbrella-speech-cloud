import hmac
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

class ZaloPaySecurity:
    @staticmethod
    def _compute_hmac(data_str: str, key: str) -> str:
        """Helper to compute HMAC-SHA256"""
        try:
            return hmac.new(key.encode(), data_str.encode(), hashlib.sha256).hexdigest()
        except Exception as e:
            logger.error(f"HMAC Error: {e}")
            return ""

    @staticmethod
    def create_order_mac(config: dict, payload: dict) -> str:
        """
        Generates the MAC for creating an order.
        Formula: app_id|app_trans_id|app_user|amount|app_time|embed_data|item
        Key: KEY1
        """
        try:
            # According to ZaloPay docs, data string format:
            data_str = (
                f"{config['app_id']}|"
                f"{payload['app_trans_id']}|"
                f"{payload['app_user']}|"
                f"{payload['amount']}|"
                f"{payload['app_time']}|"
                f"{payload['embed_data']}|"
                f"{payload['item']}"
            )
            return ZaloPaySecurity._compute_hmac(data_str, config['key1'])
        except Exception as e:
            logger.error(f"Create Order MAC Error: {e}")
            return ""

    @staticmethod
    def verify_callback_mac(data: dict, key2: str) -> bool:
        """
        Verifies the MAC from ZaloPay Callback.
        Formula: hmac(key2, data_json_string)
        Wait! ZaloPay passes `encoded_data` (the json string) and `mac`.
        We compute hmac(key2, data["data"]).
        
        Input `data` here is the parsed JSON body from the callback request.
        It should have: `data` (string), `mac` (string), `type` (int).
        """
        try:
            data_str = data.get('data') # This is a JSON string inside the JSON body
            req_mac = data.get('mac')
            
            if not data_str or not req_mac:
                return False
                
            my_mac = ZaloPaySecurity._compute_hmac(data_str, key2)
            
            return my_mac == req_mac
        except Exception as e:
            logger.error(f"Callback Verification Error: {e}")
            return False
