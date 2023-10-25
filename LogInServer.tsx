const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const mysql = require('mysql');
const axios = require('axios');
const multer = require('multer');
const path = require('path');


// const AWS = require('aws-sdk');
// const fs = require('fs')

// const BUCKET_NAME = 'bucket-ns50k8'
// AWS.config.update({
//   region:         'ap-northeast-2',
//   accessKeyId:    'AKIA5ZW2Z2PNRCPEHGNK',
//   secretAccessKey:'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'
// })

// const filename = '박승하TR' // 버킷에 저장할 이름
// const imageStream = fs.createReadStream('/Users/iseungjun/Desktop/개발/GymPrivate/src/images/parkseung.jpeg')  // 버킷에 업로드할 이미지
// const params = { Bucket:BUCKET_NAME, Key:filename, Body:imageStream, ContentType: 'image' }
// const upload = new AWS.S3.ManagedUpload({ params });
// upload.promise()



const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
// Enable CORS for all origins
app.use(cors());
app.use(express.static('public'));

// Create a connection to the MySQL database
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'ded98ff0607',
    database: 'gymreservation',
    multipleStatements: true // Allow executing multiple statements in a single query
});

// Connect to the database
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to the database: ', err);
        return;
    }
    console.log('Connected to the MySQL database!');
});

const db = connection;


// mysql user table 에 연결 및 데이터 전송 서버코드.

app.post('/user', function (req, res) {
    const { logId, username, email, gender, ageRange, birthday } = req.body;
    const createdtime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const connected_at = new Date().toISOString().slice(0, 19).replace('T', ' ');

    // Check if the user already exists in the database
    const checkUserQuery = `SELECT * FROM user WHERE log_Id = '${logId}'`;
    db.query(checkUserQuery, function (error, results) {
        if (error) {
            console.error('Error checking user:', error);
            res.status(500).send('Error checking user');
            return;
        }

        // If user exists, send a response indicating the user already exists
        if (results.length > 0) { 
            console.log('User already exists');
            res.send('User already exists');
            return;
        }

        // If user does not exist, insert the new user into the database
        const insertUserQuery = `INSERT INTO user (log_id, username, email, gender, ageRange, birthday, createdtime, connected_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
        const insertUserValues = [logId, username, email, gender, ageRange, birthday, createdtime, connected_at];

        db.query(insertUserQuery, insertUserValues, function (error, results, fields) {
            if (error) {
                console.error('Error creating user:', error);
                res.status(500).send('Error creating user');
                return;
            }

            console.log('User created successfully');
            res.send('User created successfully');
        });
    });
});





// mysql reservation table에 연결 및 데이터 전송 서버 코드.
app.post('/reservation', function(req, res) {
    const room_number = req.body.room;
    const date_of_use = req.body.date;
    const startTime = req.body.startTime;
    const endTime = req.body.endTime;
    const time_of_use = startTime + '-' + endTime;
    const usingTime = req.body.usingTime;
    const amount = req.body.amount;
    console.log(amount);
    
    const { logId, username, email, gender, ageRange, birthday } = req.body;
    const merchantUid = req.body.merchantUid

    
    // 1. Check if the user already exists based on email
    const userQuery = `SELECT uid FROM user WHERE log_id = '${logId}'`;
    connection.query(userQuery, function(error, results, fields) {
        if (error) {
            console.error('Error checking user existence: ', error);
            res.status(500).send('Error checking user existence');
            return;
        }
        
        let uid;
        if (results.length > 0) {
            uid = results[0].uid;
            insertReservation(uid);
        } else {
            const createUserQuery = `INSERT INTO user (username, email, gender, ageRange, birthday, createdtime, connected_at) 
                                    VALUES ('${username}', '${email}', '${gender}', '${ageRange}', '${birthday}', NOW(), NOW())`;
            connection.query(createUserQuery, function(error, results, fields) {
                if (error) {
                    console.error('Error creating user: ', error);
                    res.status(500).send('Error creating user');
                    return;
                }
                
                uid = results.insertId;
                insertReservation(uid);
            });
        }
        
        function insertReservation(uid) {
    // 2. Insert reservation information with the retrieved or generated uid
    const insertReservationQuery = `INSERT INTO reservation (uid, room_number, date_of_use, time_of_use, usingTime, merchant_uid, amount) 
                                    VALUES (${uid}, '${room_number}', '${date_of_use}', '${time_of_use}', '${usingTime}', '${merchantUid}', ${amount})`;
    connection.query(insertReservationQuery, function(error, results, fields) {
        if (error) {
            console.error('Error creating reservation: ', error);
            res.status(500).send('Error creating reservation');
            return;
        }

        console.log('Reservation created successfully');
        res.send('Reservation created successfully');
    });
}

    });
});




//mysql db 유저정보 + 예약정보(예약정보를 위해서 쓰자) 받아서 프론트로 보내주는 코드.

app.get('/user/:log_id', async (req, res) => {
    const logId = req.params.log_id;

    const sql = `
        SELECT u.uid, u.log_id, u.username, u.email, u.gender, u.ageRange, u.birthday, u.createdtime, u.connected_at, r.rid, r.room_number, r.date_of_use, r.time_of_use, r.merchant_uid
        FROM user u
        LEFT JOIN reservation r ON u.uid = r.uid
        WHERE u.log_id = '${logId}'
        ORDER BY r.rid DESC
        LIMIT 1`;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching user data:', err);
            res.status(500).send('Error fetching user data');
            return;
        }

        const userData = results[0];
        res.json(userData);
    });
});

app.get('/userlast/:log_id', async (req, res) => {
    const logId = req.params.log_id;

    const sql = `
        SELECT u.uid, u.log_id, u.username, u.email, u.gender, u.ageRange, u.birthday, u.createdtime, u.connected_at, r.rid, r.room_number, r.date_of_use, r.time_of_use, r.merchant_uid
        FROM user u
        LEFT JOIN reservation r ON u.uid = r.uid
        WHERE u.log_id = '${logId}'
        ORDER BY r.rid DESC
        LIMIT 1 OFFSET 1`;

    connection.query(sql, (err, results) => {
        if (err) {
            console.error('Error fetching user data:', err);
            res.status(500).send('Error fetching user data');
            return;
        }

        const userData = results[0];
        res.json(userData);
    });
});



/////// 예약 슬롯 별 가격 프론트로 보내주는 코드

app.post('/booking_price/price', (req, res) => {
    const { usingTime } = req.body;

  // Replace this with your actual logic to fetch the price
  // Call your backend API or perform any necessary operations to retrieve the price based on the usingTime

  // Example logic: retrieving price from a database
    db.query('SELECT price FROM booking_price WHERE usingTime = ?', [usingTime], (err, result) => {
        if (err) {
        console.error('Error fetching price:', err);
        res.status(500).json({ error: 'Failed to fetch price' });
        } else if (result.length === 0) {
        res.status(404).json({ error: 'Price not found' });
        } else {
        const price = result[0].price;
        res.status(200).json({ price });
        }
    });
});

//예약 막아주는 엔드포인트

app.post('/reservations', (req, res) => {
  const query = `SELECT * FROM reservation`;

  // MySQL 쿼리 실행
  db.query(query, (error, results) => {
    if (error) {
      console.error('Failed to fetch reservation data:', error);
      res.status(500).json({ error: 'Failed to fetch reservation data' });
    } else {
      // 쿼리 결과를 클라이언트로 응답
      res.json(results);
    }
  });
});

app.get('/reservations', (req, res) => {
  const selectedDate = req.query.date;
  const roomNumber = req.query.roomNumber // 선택한 날짜를 요청의 쿼리 매개변수에서 가져옵니다.
  const query = `SELECT * FROM reservation WHERE room_number = '${roomNumber}' And date_of_use = '${selectedDate}'`;

  console.log(req.query.roomNumber);
  console.log(req.query.date);
  // MySQL 쿼리 실행
  db.query(query, (error, results) => {
    if (error) {
      console.error('Failed to fetch reservation data:', error);
      res.status(500).json({ error: 'Failed to fetch reservation data' });
    } else {
      // 쿼리 결과를 클라이언트로 응답
      res.json(results);
    }
  });
});






/////////////////////// PT 구매 서버코드 

app.get('/trainer', (req, res) => {
    db.query("SELECT * FROM trainer_db", (err, result) => {
        if (err) {
        console.log(err);
        res.status(500).json({ error: 'An error occurred while fetching data' });
        } else {
        console.log(result);
        res.status(200).json(result);
        }
    });
});

// 이미지 파일 업로드 API
// const storage = multer.diskStorage({ 
//   destination: function (req, file, cb) {
//     cb(null, 'public/uploads');
//   },
//   filename: function (req, file, cb) {
//     console.log(file)
//     cb(null, file.fieldname+"_"+Date.now()+path.extname(file.originalname)+".jpg");
//   },
// });
// const upload = multer({ storage: storage });

//트레이너 이미지 ㅡ 텍스트등 처리  아직 null로 수업시간 설정해놓아서 최신화 필요
// app.post('/upload', upload.single('image'), (req, res) => {
//     console.log(req.file);
//     if (!req.file) {
//         res.status(400).send('이미지 파일을 업로드해주세요');
//         return;
//     }

// const uri = `http://172.30.1.59:8080/uploads/${req.file.filename}`;
//     db.query('INSERT INTO trainer_image (image_uri) VALUES (?)', [uri], (error, results) => {
//         if (error) {
//         console.error(error);
//         res.status(500).send('서버 에러');
//         return;
//         }
//         console.log(results);
//         res.status(200).send('이미지 업로드가 완료되었습니다.');
//     });
// });
////////////////////////////////////////////////////////////////


// Trainer 데이터 특정 ID 조회 API
app.get('/trainer/:id', (req, res) => {
  const id = req.params.id;
  db.query(`SELECT * FROM trainer_db WHERE trainer_id=${id}`, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).json({ error: 'An error occurred while fetching data' });
    } else {
      console.log(result);
      res.status(200).json(result);
    }
  });
});



//위시리스트 추가 API
app.post('/wishlist', async (req, res) => {
  try {
    const id = req.body.id;
    
    // 중복된 id 값을 가진 데이터가 이미 위시리스트에 있는지 확인합니다.
    db.query(`SELECT * FROM wishlist_db WHERE trainer_id=${id}`, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: 'An error occurred while fetching data' });
      } else {
        if (result.length > 0) {
          // 중복된 id 값을 가진 데이터가 이미 위시리스트에 있으면 에러를 반환합니다.
          res.status(400).json({ error: 'Data with the same ID already exists in the wishlist' });
        } else {
          // 중복된 id 값이 없으면 트레이너 정보를 조회하고 위시리스트에 추가합니다.
          db.query(`SELECT * FROM trainer_db WHERE trainer_id=${id}`, (err, result) => {
            if (err) {
              console.log(err);
              res.status(500).json({ error: 'An error occurred while fetching data' });
            } else {
              const trainer_id = result[0].trainer_id;
              const name = result[0].name;
              const uri = result[0].uri;
              const available_time1 = result[0].available_time1;
              const available_time2 = result[0].available_time2;
              
              db.query(`INSERT INTO wishlist_db (trainer_id, name, uri, available_time1, available_time2) VALUES (${trainer_id}, '${name}', '${uri}', '${available_time1}', '${available_time2}')`, (err, insertResult) => {
                if (err) {
                  console.log(err);
                  res.status(500).json({ error: 'An error occurred while inserting data' });
                } else {
                  console.log(insertResult);
                  res.status(200).json(insertResult);
                }
              });
            }
          });
        }
      }
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

// 위시리스트 제거 API
app.delete('/wishlist/:id', async (req, res) => {
  try {
    const id = req.params.id;
    // wishlist_db에서 해당 trainer_id의 데이터를 삭제합니다.
    db.query(`DELETE FROM wishlist_db WHERE trainer_id=${id}`, (err, result) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: 'An error occurred while deleting data' });
      } else {
        console.log(result);
        res.status(200).json({ message: 'Wishlist item deleted successfully' });
      }
    }); 
  } catch (error) {
    console.log(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

//위시리스트 데이터 조회 api
app.get('/wishlist', (req, res) => {
  db.query('SELECT * FROM wishlist_db', (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).json({ error: 'An error occurred while fetching data' });
    } else {
      console.log(result);
      res.status(200).json(result);
    }
  });
});


//////////////////////////////////////////////

//결제 요청 정보 저장
app.post('/payment/requests', (req, res) => {
  const { name, amount, merchant_uid, buyer_name,buyer_tel,buyer_email } = req.body.params;
  console.log(req.body)
  // 쿼리 작성
  const values = [name, amount, merchant_uid, buyer_name, buyer_tel, buyer_email];
  const query = 'INSERT INTO payment_requests (name, amount, merchant_uid, buyer_name, buyer_tel, buyer_email) VALUES (?, ?, ?, ?, ?, ?)';
  console.log(values)
  // 쿼리 실행
  db.query(query, values, (err, result) => {
    if (err) {
      console.error('데이터베이스 쿼리 오류:', err);
      res.status(500).json({ error: '데이터베이스 쿼리 오류' });
      return;
    }

    console.log('데이터가 성공적으로 저장되었습니다.');
    res.status(200).json({ message: '데이터 저장 완료' });
  });
});

app.get('/payment/requests/:merchantUid', (req, res) => {
  const merchantUid = req.params.merchantUid; // 올바른 변수명인 merchantUid로 수정

  db.query(`SELECT * FROM payment_requests WHERE merchant_uid='${merchantUid}'`, (err, result) => {
    if (err) {
      console.log(err);
      res.status(500).json({ error: 'An error occurred while fetching data' });
    } else {
      console.log(result);
      res.status(200).json(result);
    }
  });
});


//결제검증로직
app.use(bodyParser.json());

// 인증 토큰 발급 받기
const getAccessToken = async () => {
  try {
    const PORTONE_API_KEY = "8546057587372263";
    const PORTONE_API_Secret_KEY = "Hx1sBR5xaiB5oOx7NVKaiII1Owqy0HzJqOtsz0QMbPv6tRBCS0o1TvZksCJ80D9LGhV2GvjFPrBLCq1Z";
    const response = await axios({
      url: "https://api.iamport.kr/users/getToken",
      method: "post",
      headers: { "Content-Type": "application/json" },
      data: {
        imp_key: PORTONE_API_KEY, // REST API키
        imp_secret: PORTONE_API_Secret_KEY // REST API Secret
      }
    });
    console.log(response.data.response.access_token);
    return response.data.response.access_token;
  } catch (error) {
    throw new Error("Failed to get access token")
  }
};

// POST 요청을 받는 '/portone-webhook'
app.post('/portone-webhook', async (req, res) => {
  try {
    const { imp_uid, merchant_uid } = req.body;
    console.log(req.body);
    let amountToBePaid; // Declare variable amountToBePaid

    // Retrieve order information from MySQL (retrieve amount to be paid)
    const getOrderQuery = 'SELECT amount FROM payment_requests WHERE merchant_uid = ?';
    db.query(getOrderQuery, [merchant_uid], async (error, orderResults) => {
      if (error) {
        throw new Error('Failed to fetch order information');
      }
      if (orderResults && orderResults.length > 0) {
        amountToBePaid = orderResults[0].amount; // Assign a value to the amountToBePaid variable
        console.log(orderResults[0].amount);
        // 1. Issue an access token to use the Port One API
        const access_token = await getAccessToken();

        // 2. View Port One payment history
        const apiUrl = `https://api.iamport.kr/payments/${imp_uid}`;
        const paymentResponse = await axios({
          url: `${apiUrl}?_token=${access_token}`,
          method: 'get',
          headers: { 'Authorization': `Bearer ${access_token}` },
        });

        console.log(paymentResponse.data);
        console.log(paymentResponse.data.response.amount);
        console.log(amountToBePaid);

        // 3. Compare the price in the merchant's internal order data with the actual amount paid.
        if (paymentResponse.data.response.amount === amountToBePaid) {
          // Query to save payment result to db
          const updatePaymentRequestQuery = `
            UPDATE payment_requests
            SET name = '${paymentResponse.data.response.name}',
                amount = ${paymentResponse.data.response.amount},
                cancel_amount = ${paymentResponse.data.response.cancel_amount},
                merchant_uid = '${paymentResponse.data.response.merchant_uid}',
                buyer_name = '${paymentResponse.data.response.buyer_name}',
                buyer_email = '${paymentResponse.data.response.buyer_email}',
                imp_uid = IFNULL('${paymentResponse.data.response.imp_uid}', imp_uid),
                state = IFNULL('${paymentResponse.data.response.status}', state)
            WHERE merchant_uid = '${paymentResponse.data.response.merchant_uid}';
          `;

          db.query(updatePaymentRequestQuery, (error) => {
            if (error) {
              throw new Error('Failed to update payment request.');
            }

            // SELECT query to fetch updated payment request
            const fetchUpdatedPaymentRequestQuery = `
              SELECT * FROM payment_requests WHERE merchant_uid = '${paymentResponse.data.response.merchant_uid}';
            `;

            db.query(fetchUpdatedPaymentRequestQuery, (error, result) => {
              if (error) {
                throw new Error('Failed to fetch updated payment request.');
              }

            });

            switch (paymentResponse.data.response.status) {
              case 'paid': // Payment completed
                res.send({ status: 'success', message: 'General payment successful' });
                break;
            }

            // Handle the payment completion logic after the update query
          });
        } else {
          // Payment amount mismatch. Counterfeit/falsified payment
          throw { status: 'forgery', message: 'Attempted forgery' };
        }
      } else {
        throw new Error('Order information not found');
      }
    });
  } catch (e) {
    // Payment validation failed.
    res.status(400).send(e);
  }
});


//예약내역가져오기
// 예약 내역 전체 가져오기 (특정 UID에 해당하는 예약 정보만)
app.get('/reservationHistory/:log_id', (req, res) => {
  const logId = req.params.log_id;

  const fetchReservationsByLogId = (logId) => {
    return new Promise((resolve, reject) => {
      const query = `SELECT u.uid, u.log_id, u.username, r.rid, r.room_number, r.date_of_use, r.time_of_use, r.usingTime, r.merchant_uid, rev.rvid, r.amount
                      FROM user u
                      LEFT JOIN reservation r ON u.uid = r.uid
                      LEFT JOIN review_db rev ON r.merchant_uid = rev.merchant_uid
                      WHERE u.log_id = '${logId}';
                      `;
      connection.query(query, (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  };

  fetchReservationsByLogId(logId)
    .then((reservations) => {
      console.log('Reservations:', reservations);
      res.json(reservations);
    })
    .catch((error) => {
      console.error('Error fetching reservations:', error);
      res.status(500).json({ error: 'An error occurred while fetching reservations' });
    });
});


/////////total 운동시간
app.get('/totalUsingTime/:log_id', (req, res) => {
  const logId = req.params.log_id;

  // Query the database to get the total exercise time for the given logId
  const query = `
    SELECT SUM(r.usingTime) as totalUsageTime
    FROM user u
    LEFT JOIN reservation r ON u.uid = r.uid
    WHERE u.log_id = '${logId}';
  `;

  connection.query(query, (error, results) => {
    if (error) {
      console.error(error);
      res.status(500).json({ error: 'Internal Server Error' });
    } else {
      const totalUsageTime = results[0].totalUsageTime || 0;
      res.json({ totalUsageTime });
    }
  });
});

////////리뷰 db에 집어넣기
////////리뷰 db에 집어넣기
app.post('/review', (req, res) => {
  const { rating, reviewText, logId, merchant_uid,room_number } = req.body;
  console.log(req);
  // 데이터베이스에 INSERT 쿼리를 실행합니다.
  const reviewSql = 'INSERT INTO review_db (log_id, merchant_uid, star_rating, review,room_number) VALUES (?, ?, ?, ?,?)';
  db.query(reviewSql, [logId, merchant_uid, rating, reviewText,room_number], (err, result) => {
    if (err) {
      console.error('리뷰 작성 실패:', err);
      res.status(500).json({ error: '리뷰 작성 중 오류가 발생했습니다.' });
    } else {
      console.log('리뷰 작성 완료:', result);
      res.status(200).json({ message: 'Review inserted successfully' });
    }
  });
});


//reviews 엔드포인트에 대한 GET 요청 핸들러
app.get('/reviews/:roomNumber', (req, res) => {
  const roomNumber = req.params.roomNumber;

  // 존재하는지 확인하기 위한 쿼리
  const checkQuery = `
    SELECT COUNT(*) AS count
    FROM review_db
    WHERE room_number = ${roomNumber};
  `;

  connection.query(checkQuery, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'An error occurred while checking reviews' });
    }

    const count = results[0].count;

    if (count > 0) {
      const query = `
        SELECT r.*, u.username, u.gender
        FROM review_db r
        LEFT JOIN user u ON r.log_id = u.log_id
        WHERE r.room_number = ${roomNumber};
      `;

      connection.query(query, (error, results) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: 'An error occurred while fetching reviews' });
        }

        res.json(results);
      });
    } else {
      res.json([]);
    }
  });
});

app.get('/average_rating/:room_number', (req, res) => {
  const roomNumber = req.params.room_number;
  const query = `SELECT AVG(star_rating) AS average_rating FROM review_db WHERE room_number = ?`;

  connection.query(query, [roomNumber], (err, results) => {
    if (err) {
      console.error('Error while fetching average rating:', err);
      res.status(500).json({ error: 'Error while fetching average rating' });
    } else {
      const averageRating = results[0].average_rating;
      res.json({ average_rating: averageRating });
    }
  });
});




//회원권 관련 서버
//회원권 상품 데이터 들고오기 from period_membership_product 테이블에서
app.get('/period_membership_product', (req, res) => {
  // Execute a query to fetch data from the period_membership_product table
  db.query('SELECT * FROM period_membership_product', (error, results) => {
    if (error) {
      console.error('Error fetching period_membership_product data:', error);
      res.status(500).json({ error: 'An error occurred' });
    } else {
      res.json(results);
    }
  });
});

//기간권 멤버쉽 저장

app.post('/period_membership', async (req, res) => {
  try {
    const { name, duration, merchantUid, pstate } = req.body;
    const { logId, username, email, gender, ageRange, birthday } = req.body;

    // Calculate the expiration date based on the duration
    const startDate = new Date();
    const expirationDate = new Date(startDate.getTime() + duration * 24 * 60 * 60 * 1000); // Add duration in milliseconds

    // Check if the user exists
    const userQuery = `SELECT uid FROM user WHERE log_id = '${logId}'`;
    connection.query(userQuery, function (error, results, fields) {
      if (error) {
        console.error('Error checking user existence: ', error);
        res.status(500).send('Error checking user existence');
        return;
      }

      let uid;
      if (results.length > 0) {
        // User already exists, retrieve the uid
        uid = results[0].uid;
        insertMembership(uid);
      } else {
        // User does not exist, create a new user
        const createUserQuery = `INSERT INTO user (log_id, username, email, gender, age_range, birthday) VALUES (?, ?, ?, ?, ?, ?)`;
        const createUserValues = [logId, username, email, gender, ageRange, birthday];
        connection.query(createUserQuery, createUserValues, function (error, results, fields) {
          if (error) {
            console.error('Error creating user: ', error);
            res.status(500).send('Error creating user');
            return;
          }

          // Retrieve the newly created uid
          uid = results.insertId;
          insertMembership(uid);
        });
      }

      // Function to insert the membership using the retrieved uid
      function insertMembership(uid) {
        // Create the SQL query
        const insertQuery = `INSERT INTO period_membership (name, start_date, expiration_date, uid, merchant_uid, pstate, duration) VALUES (?, ?, ?, ?, ?, ?, ?)`;
        const insertValues = [
          name,
          startDate.toISOString().split('T')[0],
          expirationDate.toISOString().split('T')[0],
          uid,
          merchantUid,
          pstate,
          duration,
        ];

        // Execute the query
        connection.query(insertQuery, insertValues, (error, results) => {
          if (error) {
            console.error('Error creating period membership: ', error);
            res.status(500).json({ error: 'Failed to create period membership' });
          } else {
            res.status(201).json({ message: 'Period membership created successfully' });
          }
        });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create period membership' });
  }
});

//로그아이디로 uid조회
app.get('/user', (req, res) => {
  // Retrieve the logid from the query parameters
  const logId = req.query.logid;

  // Query the user table to get the uid based on the logid
  const query = `SELECT uid FROM user WHERE log_id = '${logId}'`;

  // Execute the query
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      res.status(500).json({ error: 'Error querying the database' });
      return;
    }

    if (results.length > 0) {
      // User exists, retrieve the uid value
      const uid = results[0].uid;
      res.json({ uid: uid });
    } else {
      // User not found
      res.status(404).json({ error: 'User not found' });
    }
  });
});

////period_membership pstate조회
app.get('/membership', (req, res) => {
  // Retrieve the uid from the query parameters
  const uid = req.query.uid;
  
  // Query the period_membership table to get the pstate based on the uid
  const query = `SELECT pstate FROM period_membership WHERE uid = '${uid}'`;

  // Execute the query
  connection.query(query, (err, results) => {
    if (err) {
      console.error('Error querying the database:', err);
      res.status(500).json({ error: 'Error querying the database' });
      return;
    }


    if (results.length > 0) {
      // Membership record found, retrieve the pstate value
      const pstate = results[0].pstate;
      res.json({ p_state: pstate });
    } else {
      // Membership record not found
      res.status(404).json({ error: 'Membership record not found' });
    }
  });
});


//기간권 유효기간 확인
app.get('/update-membership-status', (req, res) => {
  
  const currentDate = new Date();

  // Format the current date to YYYY-MM-DD format
  const formattedDate = currentDate.toISOString().split('T')[0];

  // Query to update membership status
  const updateQuery = `
    UPDATE period_membership
    SET pstate = 0
    WHERE expiration_date <= '${formattedDate}'
  `;
  

  // Execute the update query
  connection.query(updateQuery, (err, results) => {
    if (err) {
      console.error('Error updating membership status:', err);
      res.status(500).send('Internal Server Error');
      return;
    }

    console.log(`Updated ${results.changedRows} membership status`);

    // Send a response indicating the number of updated rows
    res.send(`Updated ${results.changedRows} membership status`);
  });
});


//회원에 따라 회원권 정보가져오기
app.get('/Mymembership', (req, res) => {
  const { uid, pstate } = req.query;
  const query = `SELECT * FROM period_membership WHERE uid = ? AND pstate = ?`;

  // Execute the query with the provided parameters
  connection.query(query, [uid, pstate], (error, results) => {
    if (error) {
      console.error('Error retrieving period membership:', error);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the period membership data as a JSON response
      res.json(results);
    }
  });

});




app.post('/payments/cancel', async (req, res, next) => {
  try {
    const access_token = await getAccessToken();
    const { body } = req;
    const { merchant_uid, reason, cancel_request_amount } = body;

    const selectPaymentQuery = `
      SELECT imp_uid, amount, cancel_amount
      FROM payment_requests
      WHERE merchant_uid = '${merchant_uid}'
      LIMIT 1;
    `;

    connection.query(selectPaymentQuery, async function (error, results, fields) {
      if (error) {
        console.error('Error retrieving payment information:', error);
        res.status(500).json({ message: 'Error retrieving payment information' });
        return;
      }

      if (results.length === 0) {
        res.status(404).json({ message: 'Payment not found' });
        return;
      }

      const paymentData = results[0]; // 조회된 결제 정보
      const { imp_uid, amount, cancel_amount } = paymentData;
      const cancelableAmount = amount - cancel_amount;

      if (cancelableAmount <= 0) {
        return res.status(400).json({ message: '이미 전액 환불된 주문입니다.' });
      }

      const getCancelData = await axios({
        url: 'https://api.iamport.kr/payments/cancel',
        method: 'post',
        headers: {
          'Content-Type': 'application/json',
          Authorization: access_token,
        },
        data: {
          reason,
          imp_uid,
          amount: cancel_request_amount,
          checksum: cancelableAmount,
        },
      });

      const { response } = getCancelData.data; 

      const updateStatusQuery = `
        UPDATE payment_requests
        SET state = '${response.status}',
            cancel_amount = ${response.cancel_amount}
        WHERE merchant_uid = '${merchant_uid}';
      `;


      connection.query(updateStatusQuery, function (error, results, fields) {
        if (error) {
          console.error('Error updating payment status:', error);
          res.status(500).json({ message: 'Error updating payment status' });
          return;
        }

        const deleteReservationQuery = `
          DELETE FROM reservation
          WHERE merchant_uid = '${merchant_uid}';
        `;

        connection.query(deleteReservationQuery, function (error, results, fields) {
          if (error) {
            console.error('Error deleting reservation:', error);
            res.status(500).json({ message: 'Error deleting reservation' });
            return;
          }

          res.status(200).json({ message: '환불이 성공적으로 처리되었습니다.' });
        });
      });
    });
  } catch (error) {
    console.error('Error processing cancellation:', error);
    res.status(500).json({ message: '환불 처리 중에 오류가 발생했습니다.' });
  }
});

app.post("/delete_reservation/:merchant_uid", (req, res) => { // 슬래시 위치 수정
  const { merchant_uid } = req.params; // req.body에서 변경해서 req.params로 수정
  console.log(merchant_uid);
  const sql = "DELETE FROM reservation WHERE merchant_uid = ?";
  
  connection.query(sql, [merchant_uid], (err, result) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).json({ error: "Error executing query." });
    } else {
      console.log("Deleted rows:", result.affectedRows);
      res.json({ message: "Data deleted successfully." });
    }
  });
});

app.get('/trainer_averagerating/:id', (req, res) => {
  const id = req.params.id;
  const query = `SELECT AVG(star_rating) AS average_rating FROM trainer_review_db WHERE trainer_id = ?`;

  connection.query(query, [id], (err, results) => {
    if (err) {
      console.error('Error while fetching average rating:', err);
      res.status(500).json({ error: 'Error while fetching average rating' });
    } else {
      const averageRating = results[0].average_rating;
      res.json({ average_rating: averageRating });
    }
  });
});


app.get('/trainer_reviews/:id', (req, res) => {

  const id = req.params.id;
  console.log(id)

  // 존재하는지 확인하기 위한 쿼리
  const checkQuery = `
    SELECT COUNT(*) AS count
    FROM trainer_review_db
    WHERE trainer_id = ${id};
  `;

  connection.query(checkQuery, (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'An error occurred while checking reviews' });
    }

    const count = results[0].count;
    console.log(count)

    if (count > 0) {
    const query = `
      SELECT r.*, u.username, u.gender
      FROM trainer_review_db r
      LEFT JOIN user u ON r.log_id = u.log_id
      WHERE r.trainer_id = ${id};
    `;

      connection.query(query, (error, results) => {
        if (error) {
          console.error(error);
          return res.status(500).json({ error: 'An error occurred while fetching reviews' });
        }
        res.json(results);
      });
    } else {
      res.json([]);
    }
  });
});

app.get('/PTproduct/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
    SELECT
    trainer_db.trainer_id,
    trainer_db.name AS trainer_name,
    PT_product.session,
    PT_product.price
    FROM
      trainer_db
    LEFT JOIN
      PT_product ON trainer_db.trainer_id = PT_product.trainer_id
    WHERE
      trainer_db.trainer_id = ?;
    `;
    
    connection.query(query, [id], (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching data' });
      } else {
        res.json(results);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/training_membership', async (req, res) => {
  try {
    const { name, merchantUid, pstate,startDate,Gender,Session,TrainerId } = req.body;
    const { logId, username, email, gender, ageRange, birthday } = req.body;


    // Check if the user exists
    const userQuery = `SELECT uid FROM user WHERE log_id = '${logId}'`;
    connection.query(userQuery, function (error, results, fields) {
      if (error) {
        console.error('Error checking user existence: ', error);
        res.status(500).send('Error checking user existence');
        return;
      }

      let uid;
      if (results.length > 0) {
        // User already exists, retrieve the uid
        uid = results[0].uid;
        insertMembership(uid);
      } else {
        // User does not exist, create a new user
        const createUserQuery = `INSERT INTO user (log_id, username, email, gender, age_range, birthday) VALUES (?, ?, ?, ?, ?, ?)`;
        const createUserValues = [logId, username, email, gender, ageRange, birthday];
        connection.query(createUserQuery, createUserValues, function (error, results, fields) {
          if (error) {
            console.error('Error creating user: ', error);
            res.status(500).send('Error creating user');
            return;
          }

          // Retrieve the newly created uid
          uid = results.insertId;
          insertMembership(uid);
        });
      }

      // Function to insert the membership using the retrieved uid
      function insertMembership(uid) {
        // Create the SQL query
        const insertQuery = `INSERT INTO training_membership (name, uid, merchant_uid, pstate,gender,start_Date,session,trainer_id) VALUES (?,  ?, ?, ? ,? ,?,?,?)`;
        const insertValues = [
          name,
          uid,
          merchantUid,
          pstate,
          Gender,
          startDate,
          Session,
          TrainerId
        ];

        // Execute the query
        connection.query(insertQuery, insertValues, (error, results) => {
          if (error) {
            console.error('Error creating period membership: ', error);
            res.status(500).json({ error: 'Failed to create period membership' });
          } else {
            res.status(201).json({ message: 'Period membership created successfully' });
          }
        });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Failed to create period membership' });
  }
});

app.get('/trainermembershipreview/:log_id', (req, res) => {
  const logId = req.params.log_id;
  const fetchtrainermembershipreview = (logId) => {
    
    return new Promise((resolve, reject) => {
      const query = `
      SELECT
      tm.tmid,
      tm.uid,
      u.log_id,
      u.username,
      tm.merchant_uid,
      tm.name,
      tm.session,
      tm.trainer_id,
      tr.rvid
    FROM
      training_membership tm
    LEFT JOIN
      trainer_review_db tr ON tm.merchant_uid = tr.merchant_uid
    LEFT JOIN
      user u ON tm.uid = u.uid
    WHERE
      u.log_id = ?;    
      `;

      connection.query(query, [logId], (error, results) => {
        if (error) {
          reject(error);
        } else {
          resolve(results);
        }
      });
    });
  };

  fetchtrainermembershipreview(logId)
    .then((results) => {
      res.json(results);
    })
    .catch((error) => {
      console.error('예약을 가져오는 중 오류가 발생했습니다:', error);
      res.status(500).json({ error: '예약을 가져오는 중 오류가 발생했습니다' });
    });
});


app.get('/Myperiodmembership', (req, res) => {
  const { uid, pstate } = req.query;
  const query = `SELECT * FROM period_membership WHERE uid = ? AND pstate = ?`;

  // Execute the query with the provided parameters
  connection.query(query, [uid, pstate], (error, results) => {
    if (error) {
      console.error('Error retrieving period membership:', error);
      res.status(500).send('Internal Server Error');
    } else {
      // Send the period membership data as a JSON response
      res.json(results);
    }
  });

});

//회원에 따라 트레이닝회원권 정보가져오기
app.get('/Mytrainingmembership', (req, res) => {
  const { uid, pstate } = req.query;
  const query = `SELECT * FROM training_membership WHERE uid = ? AND pstate = ?`; // 수정된 쿼리

  // Execute the query with the provided parameters
  connection.query(query, [uid, pstate], (error, results) => {
    if (error) {
      console.error('Error retrieving trainer membership:', error); // 에러 메시지 변경
      res.status(500).send('Internal Server Error');
    } else {
      // Send the trainer membership data as a JSON response
      res.json(results);
    }
  });
});

app.post('/trainer_review', (req, res) => {
  const { rating, reviewText, logId, merchant_uid,name,trainer_id } = req.body;
  console.log(req);
  // 데이터베이스에 INSERT 쿼리를 실행합니다.
  const reviewSql = 'INSERT INTO trainer_review_db (log_id, merchant_uid, star_rating, review,trainer_name,trainer_id) VALUES (?, ?, ?, ?, ?,?)';
  db.query(reviewSql, [logId, merchant_uid, rating, reviewText, name,trainer_id], (err, result) => {
    if (err) {
      console.error('리뷰 작성 실패:', err);
      res.status(500).json({ error: '리뷰 작성 중 오류가 발생했습니다.' });
    } else {
      console.log('리뷰 작성 완료:', result);
      res.status(200).json({ message: 'Review inserted successfully' });
    }
  });
});

app.get('/PTproductminprice', async (req, res) => {
  try {
    const { id } = req.params;
    const query = `
        SELECT
        trainer_db.trainer_id,
        trainer_db.name AS trainer_name,
        trainer_db.uri,
        MIN(PT_product.price) AS min_price,
        trainer_db.available_time1,
        trainer_db.available_time2,
        wishlist_db.wid
      FROM
        trainer_db
      LEFT JOIN
        PT_product ON trainer_db.trainer_id = PT_product.trainer_id
      LEFT JOIN
        wishlist_db ON trainer_db.trainer_id = wishlist_db.trainer_id
      GROUP BY
        trainer_db.trainer_id, trainer_db.name, trainer_db.uri, trainer_db.available_time1, trainer_db.available_time2, wishlist_db.wid;
    `;
    
    connection.query(query, [id], (error, results) => {
      if (error) {
        console.error(error);
        res.status(500).json({ error: 'Error fetching data' });
      } else {
        res.json(results);
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});


/////////////// Start the server
app.listen(8080, function() {
    console.log('Server listening on port 3000');
});







