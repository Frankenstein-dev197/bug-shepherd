#!/bin/bash
# Script to deploy Git OAuth Edge Functions to Supabase

set -e

echo "🚀 Deploying Git OAuth Edge Functions..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it:"
    echo "   npm install -g supabase"
    echo "   OR"
    echo "   curl -fsSL https://github.com/supabase/cli/releases/download/v1.0.0/supabase_darwin_amd64.tar.gz | tar -xz"
    exit 1
fi

# Link to supabase project (if not already linked)
echo "📦 Checking Supabase link..."
supabase link --project-ref vmcyxmjiskidyqgumyqy

# Deploy Edge Functions
echo "📤 Deploying github-oauth..."
supabase functions deploy github-oauth

echo "📤 Deploying gitlab-oauth..."
supabase functions deploy gitlab-oauth

echo "📤 Deploying git-repos..."
supabase functions deploy git-repos

# Set secrets (you'll need to do this manually or use secrets set)
echo ""
echo "⚠️  IMPORTANT: Set these secrets in Supabase Dashboard > Edge Functions > Secrets:"
echo "   - GITHUB_CLIENT_ID = Ov23lijZDRhByV5gfX1C"
echo "   - GITHUB_CLIENT_SECRET = [your_github_client_secret]"
echo "   - GITLAB_CLIENT_ID = [your_gitlab_client_id]"
echo "   - GITLAB_CLIENT_SECRET = [your_gitlab_client_secret]"

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "1. Set the secrets in Supabase Dashboard"
echo "2. Run the migration: supabase db push"
echo "3. Push to Git to redeploy on Lovable"
