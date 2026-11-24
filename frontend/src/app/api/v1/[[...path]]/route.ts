import { NextRequest, NextResponse } from 'next/server'

const BACKEND_INTERNAL_URL =
  process.env.BACKEND_INTERNAL_URL || 'http://backend:8000'

async function handleProxy(
  request: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  const pathSegments = params?.path || []
  const subPath = pathSegments.length > 0 ? `${pathSegments.join('/')}/` : ''
  const search = request.nextUrl.search || ''
  const targetUrl = `${BACKEND_INTERNAL_URL}/api/v1/${subPath}${search}`

  const headers = new Headers()
  request.headers.forEach((value, key) => {
    const lowerKey = key.toLowerCase()
    // Strip hop-by-hop and host headers
    if (!['host', 'connection', 'content-length', 'transfer-encoding'].includes(lowerKey)) {
      headers.set(key, value)
    }
  })

  let body: ArrayBuffer | undefined = undefined
  if (!['GET', 'HEAD'].includes(request.method)) {
    const rawBody = await request.arrayBuffer()
    if (rawBody.byteLength > 0) {
      body = rawBody
    }
  }

  try {
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'follow',
      cache: 'no-store',
    })

    const responseHeaders = new Headers()
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      // Do not copy hop-by-hop or encoding headers
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(lowerKey)) {
        responseHeaders.set(key, value)
      }
    })

    // Explicitly prevent browser from caching API responses / redirects
    responseHeaders.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
    responseHeaders.set('Pragma', 'no-cache')
    responseHeaders.set('Expires', '0')

    const responseData = await response.arrayBuffer()
    return new NextResponse(responseData, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    })
  } catch (err: any) {
    console.error(`[Next.js API Proxy] Error forwarding to ${targetUrl}:`, err)
    return NextResponse.json(
      { error: 'Backend service communication error', message: err.message },
      { status: 502 }
    )
  }
}

export const dynamic = 'force-dynamic'

export const GET = handleProxy
export const POST = handleProxy
export const PUT = handleProxy
export const PATCH = handleProxy
export const DELETE = handleProxy
export const HEAD = handleProxy
export const OPTIONS = handleProxy
