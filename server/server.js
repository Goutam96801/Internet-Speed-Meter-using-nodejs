const express = require('express');
const axios = require('axios');
const ping = require('ping');
const os = require('os');
const cors = require('cors'); 
require('dotenv').config();

const app = express();
app.use(cors());

const port = process.env.PORT;

const downloadTestUrl = process.env.DOWNLOAD_TEST_URL; 
const uploadTestUrl = process.env.UPLOAD_TEST_URL;

const calculateOverallSpeed = async (downloadSpeed, uploadSpeed, pingTime) => {
  // Define weightage for each component (adjust as needed)
  const downloadWeight = 0.5;
  const uploadWeight = 0.3;
  const pingWeight = 0.2;

  // Calculate overall speed rating
  const overallSpeed = (downloadSpeed * downloadWeight + uploadSpeed * uploadWeight + (1 / pingTime) * pingWeight) / (downloadWeight + uploadWeight + pingWeight);
   
  return overallSpeed; 
};

const testDownloadSpeed = async () => {
  try {
    const startTime = Date.now();
    const response = await axios.get(downloadTestUrl, { responseType: 'arraybuffer' });
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; 
    const fileSizeInBytes = parseInt(response.headers['content-length'], 10);
    const fileSizeInBits = fileSizeInBytes * 8;
    const speedBps = fileSizeInBits / duration; 
    const speedMbps = speedBps / (1024 * 1024); 
    return speedMbps;
  } catch (error) {
    console.error(`Download test failed: ${error.message}`);
    return null;
  }
};
const testUploadSpeed = async () => {
  try {
    const data = '0'.repeat(1 * 1024 * 1024);
    const startTime = Date.now();
    await axios.post(uploadTestUrl, data, {
      headers: { 'Content-Type': 'application/octet-stream' },
    });
    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; 
    const fileSizeInBits = data.length * 8;
    const speedBps = fileSizeInBits / duration; 
    const speedMbps = speedBps / (1024 * 1024); 
    return speedMbps;
  } catch (error) {
    console.error(`Upload test failed: ${error.message}`);
    return null;
  }
};

const testPing = async () => {
  try {
    const host = process.env.HOST;
    const pingCount = 10; 
    const pingResults = [];

    for (let i = 0; i < pingCount; i++) {
      const response = await ping.promise.probe(host);
      pingResults.push(response.time);
    }

    const pingTime = pingResults.reduce((a, b) => a + b, 0) / pingResults.length;
    const jitter = Math.sqrt(pingResults.map(x => Math.pow(x - pingTime, 2)).reduce((a, b) => a + b) / pingResults.length);
    return { pingTime, jitter };
  } catch (error) {
    console.error(`Ping test failed: ${error.message}`);
    return { pingTime: null, jitter: null };
  }
};

const getRegion = async () => {
  try {
    const response = await axios.get(process.env.REGION_URL);
    return response.data.region;
  } catch (error) {
    console.error(`Failed to fetch region: ${error.message}`);
    return null;
  }
};

const getIPAddress = async () => {
  const networkInterfaces = os.networkInterfaces();
  for (const interfaceName in networkInterfaces) {
    const interfaces = networkInterfaces[interfaceName];
    for (const iface of interfaces) {
      if (!iface.internal && iface.family === 'IPv4') {
        return iface.address;
      }
    }
  }
  return null;
};

app.post('/speedtest', async (req, res) => {
  try {
    
    const downloadSpeed = await testDownloadSpeed();
    const uploadSpeed = await testUploadSpeed();
    const { pingTime, jitter } = await testPing();
    const region = await getRegion();
    const ipAddress = await getIPAddress();
    const overallSpeed = await calculateOverallSpeed(downloadSpeed, uploadSpeed, pingTime);
    res.status(200).json({ overallSpeed, downloadSpeed, uploadSpeed, pingTime, jitter, region, ipAddress });
  } catch (error) {
    console.error(`Speed test error: ${error.message}`);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});
