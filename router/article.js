import express from 'express'
import asyncify from 'express-asyncify'
import { configDotenv } from 'dotenv'
import { pgQuery } from '#database/postgres'
import { upload } from '#utility/kkujjang_multer/index'
import { validateArticle, validateArticlePathIndex } from '#middleware/article'
import { validatePageNumber } from '#middleware/page'
import { validatePassword } from '#middleware/password'
import cheerio from 'cheerio'

configDotenv()

export const articleRouter = asyncify(express.Router())

articleRouter.post(
  '/',
  upload('article', {
    fileNameType: 'timestamp',
    fileSize: 1024 * 1024 * 10,
    maxFileCount: 10,
    allowedExtensions: ['jpg', 'jpeg', 'png'],
  }),
  validateArticle,
  validatePassword,
  async (req, res) => {
    const { nickname, password, title, content } = req.body
    const $ = cheerio.load(content);

    $('img').each((index, element) => {
      $(element).attr('src', req.files[index]);
    });
    
    const updatedHtml = $.html();

    const keySubarray = req.files.reduce((acc, file, index) => {
      acc.push(`$${index + 5}`)
      return acc
    }, [])

    const fileLength = keySubarray.length
    const fileNumberLimit = 3
    const fileInsertQuery =
      fileLength === 0
        ? 'SELECT inserted_article.id AS id FROM inserted_article'
        : `, values_to_insert AS (
      SELECT  
        (SELECT COUNT(*) 
        FROM inserted_article
        JOIN sdms.article_file not_file ON not_file.article_id = inserted_article.id) as count,
        (SELECT id FROM inserted_article) AS article_id,
        UNNEST(ARRAY[${keySubarray.join(', ')}]) AS key
      )
      INSERT INTO sdms.article_file (article_id, file_order, key)
        SELECT article_id, count + ROW_NUMBER() OVER(), key
        FROM values_to_insert
        WHERE count + ${fileLength} <= ${fileNumberLimit}
      RETURNING article_id AS id`

    const id = (await pgQuery(
      `WITH
        inserted_article AS (
          INSERT INTO sdms.article (nickname, password, title, content) VALUES ($1, $2, $3, $4)
          RETURNING id
        )
        ${fileInsertQuery}`,
      [nickname, password, title, updatedHtml, ...req.files],
    )).rows[0].id

    res.json({ result: id})
  },
)

articleRouter.get('/list', validatePageNumber, async (req, res) => {
  const { page } = req.query

  const result = (
    await pgQuery(
      `SELECT
        id, nickname, title, created_at,
        CEIL(article_count::float / 10) AS "lastPage"
      FROM
        (SELECT
          id, nickname, title, created_at,
          COUNT(*) OVER() AS article_count
        FROM sdms.article 
        WHERE is_deleted=FALSE
        ) AS sub_table
      ORDER BY created_at DESC
      OFFSET ${(Number(page) - 1) * 10} LIMIT 10`,
    )
  ).rows

  res.json({
    lastPage: result[0]?.lastPage ?? 0,
    list:
      result?.map(({ id, nickname, title, created_at }) => ({
        id,
        nickname,
        title,
        created_at,
      })) ?? [],
  })
})

articleRouter.get('/:articleId', validateArticlePathIndex, async (req, res) => {
  const { articleId } = req.params

  const result = (
    await pgQuery(
      `SELECT id, nickname, title, content, created_at
      FROM sdms.article 
      WHERE sdms.article.id=$1 AND is_deleted=FALSE`,
      [articleId]
    )
  ).rows[0]

  if (Object.keys(result).length == 0) {
    throw {
      statusCode: 404,
      message: '게시글을 찾을 수 없습니다.',
    }
  }

  res.json({ result })
})

articleRouter.put(
  '/:articleId',
  validateArticle,
  validatePassword,
  validateArticlePathIndex,
  async (req, res) => {
    const { articleId } = req.params
    const { password, title, content } = req.body

    await pgQuery(
      `UPDATE sdms.article SET title=$1, content=$2
    WHERE password = $3 AND id=$4 AND is_deleted=FALSE`,
      [title, content, password, articleId],
    )

    res.json({ result: 'success' })
  },
)

articleRouter.delete(
  '/:articleId',
  validateArticlePathIndex,
  async (req, res) => {
    const { password, articleId } = req.params

    await pgQuery(
      `UPDATE sdms.article SET is_deleted=TRUE WHERE password=$1 AND id=$2 AND is_deleted=FALSE`,
      [password, articleId],
    )

    res.json({ result: 'success' })
  },
)
