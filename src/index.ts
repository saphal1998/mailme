import { Resend } from "resend";
export interface Env {
	RESEND_API_KEY: string;
}

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const url = new URL(request.url);
		switch (url.pathname) {
			case "/mailme": {
				const defaultCache = caches.default;

				const KEYS = {
					title: "title",
					body: "body",
					to: "to",
				} as const;

				const formData = await request.formData();
				const title = formData.get(KEYS.title)
					?.toString();
				const body = formData.get(KEYS.body)
					?.toString();
				const to = formData.get(KEYS.to)?.toString();
				const footer = "This email is sent by mailme";

				if (!title || !body || !to) {
					return Response.json({
						error: "Invalid data provided",
						body,
						to,
						title,
					}, {
						status: 422,
					});
				}

				if (title.length > 40) {
					return Response.json({
						error: "Title too long, consider a title lesser than 40 characters",
						title,
					}, {
						status: 422,
					});
				}

				const fakeKey = new URL(request.url);
				fakeKey.searchParams.append(
					KEYS.to,
					to,
				);

				const cacheKey = new Request(
					fakeKey,
				);
				const cachedResponse = await defaultCache.match(
					cacheKey,
				);
				if (cachedResponse) {
					return cachedResponse;
				}

				const resend = new Resend(env.RESEND_API_KEY);

				const { data, error } = await resend.emails
					.send({
						from: "no-reply@mailme.saphal.xyz",
						to: to ||
							"delivered@resend.dev",
						subject: `Reminder about ${title}`,
						html: `
					<!DOCTYPE html>
					<html>
					<head>
					<meta charset="UTF-8">
					<meta name="viewport" content="width=device-width, initial-scale=1.0">
					<style>
					body {
						font-family: Arial, sans-serif;
						margin: 0;
						padding: 0;
						background-color: #f9f9f9;
					}
					.email-container {
						max-width: 600px;
						margin: 20px auto;
						background: #ffffff;
						border: 1px solid #dddddd;
						border-radius: 8px;
						overflow: hidden;
					}
					.email-header {
						background-color: #4CAF50;
						color: white;
						padding: 15px;
						text-align: center;
					}
					.email-body {
						padding: 20px;
						color: #333333;
						line-height: 1.5;
					}
					.email-footer {
						background-color: #f1f1f1;
						color: #555555;
						padding: 10px;
						text-align: center;
						font-size: 12px;
					}
					</style>
					</head>
					<body>
					<div class="email-container">
					<!-- Title -->
					<div class="email-header">
					<h1>${title}</h1>
					</div>

					<!-- Body -->
					<div class="email-body">
					<p>${body}</p>
					</div>

					<!-- Footer -->
					<div class="email-footer">
					${footer}
					</div>
					</div>
					</body>
					</html>
					`,
					});

				const response = Response.json(
					{ data, error },
					{
						status: error ? 500 : 201,
						headers: {
							"Cache-Control":
								"max-age=3600",
						},
					},
				);
				ctx.waitUntil(
					defaultCache.put(
						fakeKey,
						response.clone(),
					),
				);
				return response;
			}
			default:
				return new Response("Not Found", {
					status: 404,
				});
		}
	},
} satisfies ExportedHandler<Env>;
