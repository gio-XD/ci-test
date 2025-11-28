/** @format */

// scripts/upload-to-cos.js
import COS from "cos-nodejs-sdk-v5";
import fs from "fs";
import path from "path";

// const isProd = process.env.VERCEL_ENV === "production";

// if (!isProd) {
//   console.log(
//     "[upload-to-cos] Not production (VERCEL_ENV != production), skip upload."
//   );
//   process.exit(0);
// }

// 从环境变量读取配置
const SecretId = process.env.TENCENT_SECRET_ID;
const SecretKey = process.env.TENCENT_SECRET_KEY;
const Bucket = "surf2-1377905240"; // 例如：my-next-static-123456
const Region = "ap-shanghai"; // 例如：ap-guangzhou

if (!SecretId || !SecretKey || !Bucket || !Region) {
  console.error("[upload-to-cos] Missing COS env vars, please check.");
  process.exit(1);
}

const cos = new COS({
  SecretId,
  SecretKey,
});

function walk(dir) {
  const results = [];
  const list = fs.readdirSync(dir);

  list.forEach((file) => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results.push(...walk(filePath));
    } else {
      results.push(filePath);
    }
  });

  return results;
}

async function uploadDir(localDir, remotePrefix) {
  if (!fs.existsSync(localDir)) {
    console.log(`[upload-to-cos] Skip, dir not exists: ${localDir}`);
    return;
  }

  const files = walk(localDir);

  for (const filePath of files) {
    // 相对路径，例如 static/chunks/xxx.js
    const relPath = path.relative(localDir, filePath);
    // COS 对象 key，不要以 / 开头
    const Key = path.posix.join(remotePrefix, relPath).replace(/\\/g, "/");

    console.log(`[upload-to-cos] Uploading ${filePath} -> ${Key}`);

    await new Promise((resolve, reject) => {
      cos.putObject(
        {
          Bucket,
          Region,
          Key,
          Body: fs.createReadStream(filePath),
          // 可选：缓存头，根据自己需求调整
          // Headers: {
          //   'Cache-Control': 'public,max-age=31536000,immutable',
          // },
        },
        (err, data) => {
          if (err) {
            console.error(`[upload-to-cos] Upload failed: ${filePath}`, err);
            reject(err);
          } else {
            resolve(data);
          }
        }
      );
    });
  }
}

(async () => {
  try {
    // 把 .next/static 上传到 COS 的 _next/static 路径下
    await uploadDir(
      path.join(process.cwd(), ".next", "static"),
      "_next/static"
    );

    // 如果有需要，也可以把 public 上传到根路径
    // await uploadDir(path.join(process.cwd(), 'public'), '');

    console.log("[upload-to-cos] All uploads done.");
  } catch (e) {
    console.error("[upload-to-cos] Error:", e);
    process.exit(1);
  }
})();
