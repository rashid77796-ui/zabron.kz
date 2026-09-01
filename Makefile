build:
	docker build -t ghcr.io/balgabayevd/zabron .

builder:
	docker buildx create --name multiarch --driver docker-container --use || docker buildx use multiarch

buildx: builder
	docker buildx build \
	  --platform linux/amd64 \
	  -t ghcr.io/balgabayevd/zabron:latest \
	  --push .

push:
 	docker push ghcr.io/balgabayevd/zabron:latest

tag:
 	docker tag ghcr.io/balgabayevd/zabron ghcr.io/balgabayevd/zabron:latest



