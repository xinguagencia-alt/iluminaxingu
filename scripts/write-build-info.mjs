import { execSync } from 'child_process'
import { mkdirSync, writeFileSync } from 'fs'

function getCommitSha() {
  if (process.env.RAILWAY_GIT_COMMIT_SHA) return process.env.RAILWAY_GIT_COMMIT_SHA.trim()
  if (process.env.GIT_COMMIT_SHA) return process.env.GIT_COMMIT_SHA.trim()

  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const buildInfo = {
  commit: getCommitSha(),
  builtAt: new Date().toISOString(),
  service: 'iluminaxingu-api'
}

const outputDir = 'apps/api/dist'
mkdirSync(outputDir, { recursive: true })
writeFileSync(`${outputDir}/build-info.json`, JSON.stringify(buildInfo, null, 2) + '\n')
