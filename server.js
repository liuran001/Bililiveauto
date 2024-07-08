const dotenv = require("dotenv")
dotenv.config()
const express = require('express');
const app = express();
const processFile = require('./processFile')
const appriseNotice = require("./apprise")

const PORT = process.env.port || 8081;

app.use(express.json({ extended: false }));

//  POST 请求
app.post('/', function (req, res) {
  const { id, date, type, data } = req.body;
  //读取body中的数据
  res.sendStatus(200);
  console.log(`Webhook: blrec POST 到达 事件：${type}`);

  // 判断直播事件：开播、下播、录制、视频后处理完成等
  switch (type) {
    case "VideoPostprocessingCompletedEvent": {
      processFile(data.path);
      break;
    }
    case "LiveBeganEvent": {
      const { user_info, room_info } = data;
      const text = `分区: ${room_info.parent_area_name} ${room_info.area_name}\n标题: [${room_info.title}](https://live.bilibili.com/${room_info.room_id})\n#id_${room_info.room_id} #开播`;
      const banner = `BiliLive提醒: "${user_info.name}"的直播开始了，快来看看吧！`;
      appriseNotice(banner, text);
      break;  
  }
    case "RecordingStartedEvent": {
        const { room_info } = data;
        const text = `分区: ${room_info.parent_area_name} ${room_info.area_name}\n标题: [${room_info.title}](https://live.bilibili.com/${room_info.room_id})\n#id_${room_info.room_id} #开始录制`;
        const banner = `BiliLive提醒: "${room_info.uid}"的直播已经开始录制了！\n如果赶不上直播, 也可以看回放哦!`;
        appriseNotice(banner, text);
        break;
    }
    case "LiveEndedEvent": {
        const { user_info, room_info } = data;
        const text = `分区: ${room_info.parent_area_name} ${room_info.area_name}\n标题: [${room_info.title}](https://live.bilibili.com/${room_info.room_id})\n#id_${room_info.room_id} #下播`;
        const banner = `BiliLive提醒: "${user_info.name}"的直播结束了，欢迎下次再观看！`;
        appriseNotice(banner, text);
        break;
    }
    default: {
        console.log(`Webhook: 判断类型: ${type} => 提醒未发送`);
    }
  };
})

//监听端口
const server = app.listen(PORT, function () {

  const { address, port } = server.address();
  console.log(`BiliLiveAuto脚本正在运行, 地址为 http://${address}:${port}`);
})

