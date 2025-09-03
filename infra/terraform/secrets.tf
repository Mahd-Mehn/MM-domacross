# Data sources for reading secrets/parameters at deploy time
# No resources are created here; services/tasks will reference these values.

data "aws_secretsmanager_secret_version" "jwt_private_b64" {
  secret_id = var.secret_name_jwt_private
}

data "aws_secretsmanager_secret_version" "jwt_public_b64" {
  secret_id = var.secret_name_jwt_public
}

data "aws_secretsmanager_secret_version" "doma_rpc_primary" {
  secret_id = var.secret_name_doma_rpc_primary
}

data "aws_secretsmanager_secret_version" "doma_rpc_fallback" {
  secret_id = var.secret_name_doma_rpc_fallback
}

data "aws_secretsmanager_secret_version" "alchemy_api_key" {
  secret_id = var.secret_name_alchemy_api_key
}

# SSM parameters for contract addresses

data "aws_ssm_parameter" "competition_factory_address" {
  name            = var.ssm_param_competition_factory_address
  with_decryption = false
}

data "aws_ssm_parameter" "valuation_oracle_address" {
  name            = var.ssm_param_valuation_oracle_address
  with_decryption = false
}
