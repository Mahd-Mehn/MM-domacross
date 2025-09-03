project_name = "domacross"
environment  = "prod"
aws_region   = "eu-west-1"

doma_testnet_chain_id = 0

# Secrets Manager secret names (to be created by you)
secret_name_jwt_private      = "domacross/prod/jwt_private_b64"
secret_name_jwt_public       = "domacross/prod/jwt_public_b64"
secret_name_doma_rpc_primary = "domacross/prod/doma_rpc_primary"
secret_name_doma_rpc_fallback= "domacross/prod/doma_rpc_fallback"
secret_name_alchemy_api_key  = "domacross/prod/alchemy_api_key"

# SSM Parameter names for contract addresses (write after deploy)
ssm_param_competition_factory_address = "/domacross/prod/contracts/CompetitionFactory"
ssm_param_valuation_oracle_address    = "/domacross/prod/contracts/ValuationOracle"
