# Create a function that checks if the user is logged in to AWS CLI
is_logged_in_aws() {
    if ! aws sts get-caller-identity >/dev/null 2>&1; then
      # Try logging into aws cli first, then show the below error message with aws sso login
      # Login into aws cli
      aws sso login >/dev/null 2>&1
      if ! aws sts get-caller-identity >/dev/null 2>&1; then
        RED='\033[0;31m'
        NC='\033[0m' # No Color
        echo -e "⚠️ ${RED}You are not logged in to AWS CLI.${NC}"
        echo -e "   * Please run '${RED}aws configure${NC}' to set up your AWS credentials."
        exit 1
      fi
    fi
}