// Build and deploy ConflictForge on the EC2 host whenever main changes.
// Runs inside the Jenkins container, which talks to the host Docker daemon.
pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timeout(time: 40, unit: 'MINUTES')
    buildDiscarder(logRotator(numToKeepStr: '15'))
  }

  triggers {
    githubPush()               // instant, once a GitHub webhook is configured
    pollSCM('H/2 * * * *')     // fallback: check GitHub every ~2 minutes
  }

  environment {
    // Must match the existing stack so containers are replaced and volumes (MySQL data, certs) reused
    COMPOSE_PROJECT_NAME = 'conflictforge'
    ENV_FILE = '/deploy/.env.production'
  }

  stages {
    stage('Validate config') {
      steps {
        // Fail fast (before touching running containers) if the server's env file is incomplete
        sh '''
          set -e
          missing=""
          for k in DOMAIN MYSQL_PASSWORD MYSQL_ROOT_PASSWORD JWT_ACCESS_SECRET JWT_REFRESH_SECRET GOOGLE_CLIENT_ID DOCKER_GID; do
            grep -Eq "^${k}=.+" "$ENV_FILE" || missing="$missing $k"
          done
          if [ -n "$missing" ]; then
            echo "Missing required settings in $ENV_FILE:$missing"
            exit 1
          fi
          docker compose --env-file "$ENV_FILE" config -q
          echo "Config OK"
        '''
      }
    }

    stage('Build images') {
      steps {
        sh 'docker compose --env-file "$ENV_FILE" build'
      }
    }

    stage('Deploy') {
      steps {
        sh 'docker compose --env-file "$ENV_FILE" up -d --remove-orphans'
      }
    }

    stage('Health check') {
      steps {
        sh 'curl -fsS --retry 20 --retry-delay 3 --retry-all-errors http://backend:5000/health'
        sh 'docker compose --env-file "$ENV_FILE" ps'
      }
    }
  }

  post {
    failure {
      sh 'docker compose --env-file "$ENV_FILE" logs --tail 80 backend || true'
    }
    always {
      // Keep disk usage in check on the small instance
      sh 'docker image prune -f || true'
      sh 'docker builder prune -f --filter until=72h || true'
    }
  }
}
