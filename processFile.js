const dotenv = require("dotenv");
dotenv.config()
const fs = require("fs");
const { parseString } = require("xml2js");
const moment = require("moment-timezone");
const rclone = require("rclone.js");
const appriseNotice = require("./apprise")

const rclonePath = process.env.RCLONE_PATH;
const timezone = process.env.TZ;
const noticeFileFormat = process.env.NOTICE_FILE_FORMAT;
const debug = process.env.DEBUG === "true";
const uploadOrigin = process.env.UPLOAD_ORIGIN === "true";
const deleteLocal = process.env.DELETE_LOCAL === "true";
const noticeFileUploaded = process.env.NOTICE_FILE_UPLOADED === "true"
const processDanmu = process.env.PROCESS_DANMU === "true"

/**
 * 删除指定路径下的文件
 * @param {string} filePath - 文件路径
 */
function deleteFile(filePath) {
  fs.unlink(filePath, (err) => {
    if (err) {
      console.error(`删除文件错误：${err}`);
      return;
    }
    debug && console.log(`文件 ${filePath} 已成功删除`);
  });
}

/**
 * 处理直播录像文件
 * @param {string} filepath - 录像文件路径
 * @param {string} roomid - 直播房间ID
 * @param {string} name - 直播主播名称
 * @param {string} fileopentime - 录像文件开始时间
 */
async function processFile(filepath, roomid, name, fileopentime) {
  const filepathNoExtension = filepath.slice(0, -4);
  const timeid = moment(fileopentime)
    .tz(timezone)
    .format("YYYY年MM月DD日HH时mm分ss秒SSS");

  /**
   * 上传指定格式的文件到rclone
   * @param {string} uploadFormat - 待上传的文件格式
   * @param {string} originFormat - 原始文件格式
   */
  async function rcUpload(uploadFormat, originFormat) {
    debug &&
      console.log(`上传 ${uploadFormat} 至 ${rclonePath}/${roomid}-${name}/${timeid}/`);
    const results = rclone.copy(`${filepathNoExtension}.${uploadFormat}`, `${rclonePath}/${roomid}-${name}/${timeid}/`, {
      "ignore-errors": true
    });
    results.stdout.on("data", (data) => {
      debug && console.log(`stdout: ${data}`);
    });
    results.stderr.on("data", (data) => {
      console.error(`上传 ${uploadFormat} 失败，错误：${data}`);
    });
    results.on("close", (code) => {
      if (code === 0) {
        console.log(`上传 ${uploadFormat} 成功`);
        deleteLocal &&
          deleteFile(`${filepathNoExtension}.${uploadFormat}`);
        if (!uploadOrigin && deleteLocal) {
          deleteFile(`${filepathNoExtension}.${originFormat}`);
        }
        if (noticeFileUploaded && noticeFileFormat.includes(uploadFormat)) {
          appriseNotice(`BiliLive提醒:"${name}"的直播录像文件上传成功`, `文件名：${filepathNoExtension}.${uploadFormat}`)
        }
      }
    });
  }

    /**
   * 上传mp4到rclone
   */
    const mp4Promise = new Promise((resolve, reject) => {
      try {
          if (uploadOrigin) {
              debug && console.log("开始上传mp4");
              await rcUpload("mp4");
          }
              resolve();
            } catch (error) {
              console.error("上传失败，错误：", err);
              reject(error);
            }
          });
      }
 
 /**
   * 转换弹幕格式并上传到rclone
   */
 const danmakuPromise = new Promise((resolve, reject) => {
  if (!processDanmu) {
    resolve()
    return
  }

  const xml = fs.readFileSync(
    `${filepathNoExtension}.xml`,
    "utf-8"
  );

  try {
    parseString(xml, (err, result) => {
      console.log(`弹幕数量：${result.i.d.length}`);
    });
    var danmakuExist = true;
  } catch (err) {
    console.log("无弹幕");
    var danmakuExist = false;
  }

  danmaku.on("close", async (code) => {
    if (code === 0 && danmakuExist) {
      console.log("转换danmaku成功");
      try {
        if (uploadOrigin) {
          debug && console.log("开始上传xml");
          await rcUpload("xml");
        }
        resolve();
      } catch (err) {
        reject(err);
      }
    } else {
      if (deleteLocal && !danmakuExist) {
        debug && console.log("无弹幕输出，删除 xml");
        deleteFile(`${filepathNoExtension}.xml`);
        return;
      }
      console.log(`转换弹幕格式失败，错误代码: ${code}`);
      reject(`转换弹幕格式失败，错误代码: ${code}`);
    }
  });
});


  try {
    const results = await Promise.allSettled([mp4Promise, danmakuPromise]);
    results.forEach((result) => {
      if (result.status === "fulfilled" && result.value) {
        debug && console.log(result.value);
      } else if (result.reason) {
        console.error(result.reason);
      }
    });
  } catch (err) {
    console.error(`上传文件失败：${err.message}`);
    const text = `文件路径: ${roomid}-${name}/${timeid}`;
    const banner = `BiliLive提醒: [${name}](https://live.bilibili.com/${roomid})的直播文件部分上传失败！⚠请及时查阅！`;
    appriseNotice(banner, text);
  }


module.exports = processFile;
