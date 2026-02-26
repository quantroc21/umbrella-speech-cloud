import hmac
import hashlib
import json
import logging

logger = logging.getLogger(__name__)

class MoMoSecurity:
    @staticmethod
    def sign_sha256(raw_data: str, secret_key: str) -> str:
        """
        Generates HMAC-SHA256 signature for MoMo authentication.
        """
        try:
            # MoMo requires the Key and Message to be bytes
            key_bytes = secret_key.encode('utf-8')
            msg_bytes = raw_data.encode('utf-8')
            
            # Create HMAC
            signature = hmac.new(key_bytes, msg_bytes, hashlib.sha256).hexdigest()
            return signature
        except Exception as e:
            logger.error(f"Signing Error: {e}")
            return None

    @staticmethod
    def build_signature_string(data: dict) -> str:
        """
        Constructs the raw string from the JSON payload required for signing.
        Format: key1=value1&key2=value2...
        IMPORTANT: Keys must be sorted alphabetically usually? 
        WAIT: MoMo documentation specifies a specific order for 'signature' fields.
        
        For 'createPayment': partnerCode, accessKey, requestId, amount, orderId, orderInfo, returnUrl, notifyUrl, extraData
        For 'IPN': partnerCode, accessKey, requestId, amount, orderId, orderInfo, orderType, transId, resultCode, message, payType, responseTime, extraData
        
        We will accept a raw string format directly to be safe, or build it based on specific implementation needs.
        """
        # For simplicity, we usually construct this manually in the caller to ensure exact field order
        pass

    @staticmethod
    def verify_ipn_signature(data: dict, secret_key: str) -> bool:
        """
        Verifies the signature sent by MoMo in the IPN callback.
        """
        try:
            # 1. Extract fields required for IPN signature construction
            # Order: amount, extraData, message, orderId, orderInfo, orderType, partnerCode, payType, requestId, responseTime, resultCode, transId
            
            # Note: The order is STRICT.
            raw_signature_str = (
                f"accessKey={data['accessKey']}"
                f"&amount={data['amount']}"
                f"&extraData={data['extraData']}"
                f"&message={data['message']}"
                f"&orderId={data['orderId']}"
                f"&orderInfo={data['orderInfo']}"
                f"&orderType={data['orderType']}"
                f"&partnerCode={data['partnerCode']}"
                f"&payType={data['payType']}"
                f"&requestId={data['requestId']}"
                f"&responseTime={data['responseTime']}"
                f"&resultCode={data['resultCode']}"
                f"&transId={data['transId']}"
            )
            
            # 2. Generate our own signature
            my_signature = MoMoSecurity.sign_sha256(raw_signature_str, secret_key)
            
            # 3. Compare with MoMo's signature
            is_valid = (my_signature == data['signature'])
            
            if not is_valid:
                logger.warning(f"Signature Mismatch! \nOurs: {my_signature} \nTheirs: {data['signature']}")
                # logger.debug(f"Raw String: {raw_signature_str}")
            
            return is_valid
        
        except KeyError as e:
            logger.error(f"Missing Field in IPN Data: {e}")
            return False
