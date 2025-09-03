variable "project_name" {
  description = "Project name prefix for resource naming"
  type        = string
}

variable "environment" {
  description = "Deployment environment (e.g., staging, prod)"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

# Secrets Manager secret names
variable "secret_name_jwt_private" {
  description = "AWS Secrets Manager secret name for JWT private key (base64-encoded PEM)"
  type        = string
}

variable "secret_name_jwt_public" {
  description = "AWS Secrets Manager secret name for JWT public key (base64-encoded PEM)"
  type        = string
}

variable "secret_name_doma_rpc_primary" {
  description = "AWS Secrets Manager secret name for DOMA_TESTNET_RPC_URL_PRIMARY"
  type        = string
}

variable "secret_name_doma_rpc_fallback" {
  description = "AWS Secrets Manager secret name for DOMA_TESTNET_RPC_URL_FALLBACK"
  type        = string
}

variable "secret_name_alchemy_api_key" {
  description = "AWS Secrets Manager secret name for ALCHEMY_API_KEY"
  type        = string
}

# SSM Parameter names for contract addresses per env
variable "ssm_param_competition_factory_address" {
  description = "SSM parameter name for CompetitionFactory address"
  type        = string
}

variable "ssm_param_valuation_oracle_address" {
  description = "SSM parameter name for ValuationOracle address"
  type        = string
}

variable "doma_testnet_chain_id" {
  description = "Doma testnet chain id"
  type        = number
}
