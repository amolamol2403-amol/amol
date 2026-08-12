# Contact App GitOps project

This app collects a name, email, and mobile number and stores each submission in PostgreSQL.

## Images

- Application image: `YOUR_DOCKERHUB_USERNAME/contact-app:1.0.0` (build this image)
- Database image: `postgres:16-alpine` (public official image)

## Build and publish the application image

Replace `YOUR_DOCKERHUB_USERNAME` with your Docker Hub account:

```bash
cd app
docker build -t YOUR_DOCKERHUB_USERNAME/contact-app:1.0.0 .
docker login
docker push YOUR_DOCKERHUB_USERNAME/contact-app:1.0.0
```

Edit `k8s/contact-app.yaml` and replace `YOUR_DOCKERHUB_USERNAME` with the same account name. Also change the PostgreSQL password in `k8s/postgres.yaml` and `k8s/contact-app.yaml` before deployment.

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
