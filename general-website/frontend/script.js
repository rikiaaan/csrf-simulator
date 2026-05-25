(async () => {
    const res = await fetch("/api/messages")
    const messages = await res.json()

    if (Array.isArray(messages)) {
        const messagesListElement = document.querySelector("#messages")

        messages.forEach((message) => {
            const listItemElement = document.createElement("li")
            const authorElement = document.createElement("p")
            const contentDivElement = document.createElement("div")

            authorElement.textContent = `${message.username} ${message.date}`
            contentDivElement.className = "posts-content"

            const lines = message.content.split("\n")
            lines.forEach(line => {
                const p = document.createElement("p")
                p.textContent = line
                contentDivElement.appendChild(p)
            })

            listItemElement.appendChild(authorElement)
            listItemElement.appendChild(contentDivElement)
            messagesListElement.appendChild(listItemElement)
        })
    }
})()
