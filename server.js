import express from 'express'
import cors from 'cors'
import { configDotenv } from 'dotenv'
import asyncify from 'express-asyncify'
import { articleRouter } from '#router/article'

configDotenv()

const app = asyncify(express())
app.use(cors({
  origin: 'http://localhost:3000'
}))
app.use(express.json())
app.use('/article', articleRouter)

app.use(async (err, req, res, next) => {
  const { statusCode = 500, message = 'undefined error', messages = [] } = err

  // message만 값 존재 -> message
  // messages만 값 존재 -> undefined error: {messages}
  // 둘 모두 값 존재 -> {message}: error1, error2, ...
  const errorMessage = `${message}${
    messages.length > 0 ? `: ${messages.join(', ')}` : ''
  }`

  const result = {
    error: errorMessage,
  }

  err.stack && console.log(err.stack)

  res.status(statusCode).json(result)
})

app.listen(process.env.HTTP_PORT, () => {
  console.log(`Server is listening on port ${process.env.HTTP_PORT}`)
})
