# Configuration GitHub OAuth

## Étape 1 : Configurer l'OAuth App sur GitHub

1. Allez sur : https://github.com/settings/applications/new

2. Remplissez le formulaire :
   - **Application name** : Bug Shepherd (ou le nom de votre app)
   - **Homepage URL** : `https://id-preview--8eeae6cb-a674-4681-a775-f9809214a466.lovable.app`
   - **Authorization callback URL** : `https://id-preview--8eeae6cb-a674-4681-a775-f9809214a466.lovable.app/git/callback`

3. Cliquez sur **Register application**

4. Vous recevrez :
   - **Client ID** : `Ov23lijZDRhByV5gfX1C` (déjà configuré)
   - **Client Secret** : à copier (vous le utiliserez à l'étape 2)

## Étape 2 : Configurer le Secret dans Supabase

1. Allez sur votre projet Supabase Dashboard
2. Rendez-vous dans : **Edge Functions** > **Secrets**

3. Ajoutez ces secrets :

| Secret Name | Value |
|-------------|-------|
| `GITHUB_CLIENT_ID` | `Ov23lijZDRhByV5gfX1C` |
| `GITHUB_CLIENT_SECRET` | `[votre_secret_github]` |

## Étape 3 : Déployer les Edge Functions

Dans votre terminal :

```bash
cd /workspace/project/bug-shepherd
supabase functions deploy github-oauth
supabase functions deploy gitlab-oauth
supabase functions deploy git-repos
```

## Étape 4 : Redéployer l'application Lovable

1. Poussez les changements vers votre repo Git
2. Lovable détectera automatiquement le changement et redéployera

## Étape 5 : Tester

1. Ouvrez l'application : https://id-preview--8eeae6cb-a674-4681-a775-f9809214a466.lovable.app
2. Connectez-vous
3. Allez dans **Developer** > **Git**
4. Cliquez sur **Connect GitHub**
5. Authorisez l'application sur GitHub
6. Importez vos repositories !

## Structure des routes OAuth

```
/git/callback - Callback pour GitHub et GitLab
```

Le code détecte automatiquement le provider (GitHub ou GitLab) via le code d'autorisation.
