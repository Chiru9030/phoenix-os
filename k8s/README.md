# Phoenix OS: Kubernetes & Docker Architecture Guide

This directory contains the production-grade **Kubernetes manifests** and **Docker configurations** for deploying Phoenix OS in a containerized microservices architecture.

---

## 1. Architecture Overview

```
                      ┌────────────────────────────────────────┐
                      │          Kubernetes Ingress            │
                      │             (NGINX / ALB)              │
                      └───────────────────┬────────────────────┘
                                          │
                  ┌───────────────────────┴────────────────────────┐
                  │                                                │
         Path: / (All traffic)                           Path: /api/v1/combat/*
                  │                                                │
                  ▼                                                ▼
     ┌────────────────────────┐                       ┌────────────────────────┐
     │  phoenix-web-service   │                       │ combat-engine-service  │
     │      (ClusterIP)       │                       │      (ClusterIP)       │
     └────────────┬───────────┘                       └────────────┬───────────┘
                  │                                                │
                  ▼                                                ▼
   ┌─────────────────────────────┐                  ┌─────────────────────────────┐
   │    phoenix-web-deployment   │                  │  combat-engine-deployment   │
   │   (Next.js 16 + React 19)   │                  │  (Java 21 / Spring Boot 3)  │
   │    Replicas: 2-10 (HPA)     │                  │     Replicas: 2-8 (HPA)     │
   └─────────────────────────────┘                  └─────────────────────────────┘
```

---

## 2. Testing Locally for Free ($0)

You can run this full multi-service architecture locally using **Docker Compose** or **Minikube** without paying any cloud provider.

### Option A: 1-Click with Docker Compose
Run both the Next.js app and the Java combat microservice:
```bash
# In the repository root
docker compose up --build
```
* **Phoenix OS Web UI**: `http://localhost:3000`
* **Java Combat Microservice**: `http://localhost:8080/api/v1/combat/status`

---

### Option B: Local Kubernetes (Minikube / Docker Desktop)

1. **Start your local Kubernetes cluster:**
   ```bash
   minikube start
   # Or enable Kubernetes inside Docker Desktop Settings
   ```

2. **Build container images into your local K8s registry:**
   ```bash
   # Point your shell to minikube's Docker daemon
   eval $(minikube docker-env)

   # Build images
   docker build -t phoenix-os-web:latest .
   docker build -t phoenix-combat-engine:latest ./services/combat-engine
   ```

3. **Deploy the cluster manifests:**
   ```bash
   # 1. Create namespace
   kubectl apply -f k8s/namespace.yaml

   # 2. Apply config and secrets
   kubectl apply -f k8s/configmap.yaml
   cp k8s/secret.example.yaml k8s/secret.yaml
   kubectl apply -f k8s/secret.yaml

   # 3. Deploy Phoenix OS and the Java Combat Engine
   kubectl apply -f k8s/phoenix-web.yaml
   kubectl apply -f k8s/combat-engine.yaml

   # 4. Apply Ingress & Horizontal Pod Autoscalers (HPA)
   kubectl apply -f k8s/ingress.yaml
   kubectl apply -f k8s/hpa.yaml
   ```

4. **Verify running pods & services:**
   ```bash
   kubectl get pods -n phoenix-system
   kubectl get svc -n phoenix-system
   kubectl get hpa -n phoenix-system
   ```

---

## 3. Kubernetes Manifest Breakdown

| File | Resource Kind | Purpose |
| :--- | :--- | :--- |
| [`k8s/namespace.yaml`](./namespace.yaml) | `Namespace` | Creates the isolated `phoenix-system` boundary. |
| [`k8s/configmap.yaml`](./configmap.yaml) | `ConfigMap` | Non-sensitive cluster configurations and internal DNS URLs. |
| [`k8s/secret.example.yaml`](./secret.example.yaml) | `Secret` | Sensitive API keys and database credentials. |
| [`k8s/phoenix-web.yaml`](./phoenix-web.yaml) | `Deployment` + `Service` | Next.js frontend with rolling updates and HTTP probes. |
| [`k8s/combat-engine.yaml`](./combat-engine.yaml) | `Deployment` + `Service` | Java 21 Spring Boot combat calculation service with `/actuator/health` probes. |
| [`k8s/ingress.yaml`](./ingress.yaml) | `Ingress` | Path-based routing uniting the Next.js app and Java service under one domain. |
| [`k8s/hpa.yaml`](./hpa.yaml) | `HorizontalPodAutoscaler` | Dynamic autoscaling based on CPU/Memory load thresholds. |
