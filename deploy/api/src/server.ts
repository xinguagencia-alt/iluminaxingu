import { createApp } from './app.js'
import { ensureDatabaseSchema } from './schema.js'

const app = createApp()
const port = process.env.PORT || 3333

ensureDatabaseSchema()
  .then(() => {
    app.listen(port, () => {
      console.log(`IluminaXingu API running at http://localhost:${port}`)
    })
  })
  .catch((error) => {
    console.error('Erro ao preparar banco de dados:', error)
    process.exit(1)
  })
