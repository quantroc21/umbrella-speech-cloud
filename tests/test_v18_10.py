import sys
import os
sys.path.append(os.getcwd())
import torch
from fish_speech.models.text2semantic.inference import _fast_decode_loop
from unittest.mock import MagicMock

def test_fast_decode_loop():
    print("Testing _fast_decode_loop syntax and basic runtime...")
    
    # Mock Model
    model = MagicMock()
    model.config.num_codebooks = 8
    model.tokenizer.semantic_begin_id = 0
    
    # Mock Utils
    def forward_generate_fast(hs, input_pos):
        # Return dummy logits
        return torch.randn(1, 1024, device=hs.device)
    
    def fast_embeddings(idx):
        return torch.randn(1, 1, 1024, device=idx.device)
        
    model.forward_generate_fast = forward_generate_fast
    model.fast_embeddings = fast_embeddings
    
    # Dummy Inputs
    device = "cpu"
    hidden_states = torch.randn(1, 1, 1024, device=device)
    initial_codebook = torch.tensor([[100]], device=device) # Shape [1, 1]?
    previous_tokens = None
    sampling_kwargs = {"temperature": 0.7}
    
    # Run
    try:
        # We need to ensure _fast_decode_loop can be called. 
        # Note: It is decorated with @torch.compile. On CPU windows it might warn or fallback.
        out = _fast_decode_loop(
            model,
            hidden_states,
            initial_codebook,
            0, # semantic_begin_id
            previous_tokens,
            sampling_kwargs
        )
        print("Success! Output shape:", out.shape)
    except Exception as e:
        print(f"FAILED: {e}")
        raise e

if __name__ == "__main__":
    test_fast_decode_loop()
