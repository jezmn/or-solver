// page controller (segmented from the inline script in frontend/index.html)

            document.addEventListener("alpine:init", () => {
                Alpine.store(
                    "dark",
                    document.documentElement.classList.contains("dark"),
                );
            });

            function landingPage() {
                const store = Alpine.store("i18n");
                if (store && store.init) store.init();
                return {
                    cards: [
                        {
                            titleKey: "index.card.lp",
                            href: "linear-programming",
                            descKey: "index.card.lp.desc",
                        },
                        {
                            titleKey: "index.card.ip",
                            href: "integer-programming",
                            descKey: "index.card.ip.desc",
                        },
                        {
                            titleKey: "index.card.transport",
                            href: "transportation",
                            descKey: "index.card.transport.desc",
                        },
                        {
                            titleKey: "index.card.goal",
                            href: "goal-programming",
                            descKey: "index.card.goal.desc",
                        },
                        {
                            titleKey: "index.card.assignment",
                            href: "assignment",
                            descKey: "index.card.assignment.desc",
                        },
                    ],
                };
            }
