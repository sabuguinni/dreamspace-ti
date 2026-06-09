import type { NextConfig } from "next"
import createMDX from "@next/mdx"

const withMDX = createMDX({})

const nextConfig: NextConfig = {
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // pdfkit lê os seus ficheiros de font (.afm) via __dirname em runtime; se for bundlado
  // pelo build standalone, o caminho fica /ROOT/node_modules/... (inexistente) -> ENOENT.
  // Tratar como external garante que resolve do node_modules real.
  serverExternalPackages: ["pdfkit"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "api.dicebear.com",
        pathname: "/**",
      },
    ],
  },
}

export default withMDX(nextConfig)
