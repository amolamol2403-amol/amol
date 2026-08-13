# Contact App GitOps project

This app collects a name, email, and mobile number and stores each submission in PostgreSQL.

## Images

- Application image: `amolamol2403/contact-app:1.0.1` (build this image)
- Database image: `postgres:16-alpine` (public official image)

## Build and publish the application image

Replace `YOUR_DOCKERHUB_USERNAME` with your Docker Hub account:

```bash
cd app
docker build -t amolamol2403/contact-app:1.0.1 .
docker login
docker push amolamol2403/contact-app:1.0.1
```

The supplied manifest is set to `amolamol2403/contact-app:1.0.1`. The application validates Aadhaar input but stores only a SHA-256 hash. It does not list submitted details on the page.

## GitOps layout

Push this entire directory to a Git repository. In the Argo CD application, set:

- Repository: your Git repository
- Revision: `main`
- Path: `k8s`
- Destination server: `https://kubernetes.default.svc`
- Namespace: `contact-app`

Argo CD will create the namespace, database, application, and NodePort Service.

## Local deploy test

```bash
kubectl apply -f k8s/
kubectl get svc -n contact-app
```

Open `http://NODE_IP:NODEPORT` shown for the `contact-app` service.
