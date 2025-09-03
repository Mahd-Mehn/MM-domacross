# Terraform Skeleton (AWS)

This directory provides a skeleton to deploy DomaCross to AWS later. It avoids hardcoded values and expects configuration via tfvars and environment.

Contents:
- providers.tf: AWS provider definition
- variables.tf: Inputs for project/env/region and secret/parameter names
- environments/: example tfvars for staging and prod

Next steps (to implement later):
- VPC, subnets, NAT/IGW
- RDS Postgres 15, ElastiCache Redis 7
- ECS Fargate services for web and api
- ALB + WAF (basic rules)
- Secrets Manager for JWT, RPC URLs, ALCHEMY; SSM parameters for contract addresses

Usage:
- Set AWS credentials in your environment
- terraform init
- terraform plan -var-file=environments/staging.tfvars

Note: This skeleton does not define resources yet to keep validation passing until variables are finalized. Modules can be added incrementally.
