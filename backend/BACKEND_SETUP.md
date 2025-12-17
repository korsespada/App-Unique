# Telegram Mini App - Backend Setup

## Prerequisites
- Node.js 14 or higher
- npm (comes with Node.js)
- Telegram Bot Token (from @BotFather)
- Telegram Chat ID where order notifications will be sent
- Google Cloud Project with Google Sheets API enabled
- Service account with access to your Google Sheet

## Installation

1. Clone the repository and navigate to the project directory:
   ```bash
   git clone <repository-url>
   cd tg-miniapp-backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file in the project root with the following variables:
   ```
   PORT=3000
   BOT_TOKEN=your_telegram_bot_token
   MANAGER_CHAT_ID=your_telegram_chat_id
   GOOGLE_SERVICE_ACCOUNT_EMAIL=backend@yeezyunique.iam.gserviceaccount.com
   GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQCggiJxVYfrn1yq\nSbhJvPS7o1/052j9fC+aSByAJ0/zrsdpxWwiK59XhWwlX0emXDBTxP1pjWUZ8ymU\nAvIvWlTGxEf57/GQuXUqb4eFz5drH+JVpANWGX2coJ2ehfBbeuAkCDPc8qTu44jH\nkbiujNlwNYv5eEmntL3u7635ly+Hc9jKLquJdrVvVBZ0vxenwNDvaRyHH2dkq1Ch\n2lVyIPpNbmYVbD71mw4OCJL7JNya76DFNXsnIrWNC6hf2JYS+B85PGfnHl3rMtiu\n4ZKr6Xdgh8GdDZUoj0Jc5itQv/R7IwiQFshaUX4MrhvPW5DK/GOL1Dw+JtEeuQwR\nwUrouRnHAgMBAAECggEAGSf8PPYSTPgXnmractgmJUh4UBp6xovRrCUULnO64K7q\neyXhikN7AE0dg4f441Z8joyHySTLjTMit5t0mL5YHiUCQOZ93lhqyCFdxLeh/Dyt\njQ2dJj/tg4Ba488LOlM6UPtmIYF4HybTN7AbmWPi6mbCDvHu3VWDFTFEe6NZ5Ckg\n6yYn1m63pOeXvYQ7oC8ObPdsbJiAiEbcvQl1Z47SNAWJZTNXpphLvuhc0t1j4R9z\nqFMJEFZHAvkbxdcLfGvzT+iEcqQRbaqc+Mi/7Vn9WVnoaq0DYE10JED956unmlEB\nOtG2tNGjbp+Dm9OemMvluTidTngxukdECPjILLRW4QKBgQDN8d84PeglN4RfEQA4\nrAGrMeKohHg6V5TWmnQOnt7X/9cZA9+kGf6Q2mYwto0Te5vvz3Ms4cLUAVb7nCHX\noa7ldtLYLqH8V03Q2GNMXUkEPR00o0d91NZxIywjieOO3HfIFl+bEotzj2DkK4Iy\nXrpatVbKiGGaG5RCASPWbMYZJwKBgQDHhSbc8WU2sLvGKpwJgTGxPFOP/H+xuTkx\nyogmIBqS/EKdF2mqhhNjyYuis5iaHdxTkL1sbnCO+x9dkmhW5j2H32cF10DZnXbU\nIxCOjq6J9am8s6db/tMposZzYRXDfocTEcySquwnqwy8Iu1vHHQeEc/D57RJeyy1\nBhCI6/EeYQKBgQCztKJGrmZ6y0X7upcJ3LYcD4yr5eQPbMsYtHAfLexgaQPl9SZa\nSMCE376aNUFHRe5dRRVIjbt3SbAAIE67nX9DBfuX3qFE0124pomHYkNLqpRokS3a\nFDYHRVzHqhPiXmk7NKK6a2U6Mlum3nxevaA5dNFGK9mXIweszNfbzNDTswKBgQCt\n9/QDApj2LvQLvmt//h6OI8PY8JmHJbIxMB+23pdNQpfy0c9Y2L9fawVOQLr25sKO\nOs5wFXwfr+eRd29zFh7gsnLqLN5m4V4Tat+s7cxSjtoJp7xuAqusyjmvsR+A7npo\nrkRqPo7bp9Ha2bmeAHlfHrjCYO5ahARfc4JHYTNFAQKBgQCpDEufw3sh4R5AqbDP\nJm9ZvhYwgVJjhYTXZWAVVgWOy8McwUxPSnjzFnCLhxQ8c4O4SwfR72Fgy0k7lYcH\nFgNWEK32fqZptWcBye+JxewKkMPaC+VZLbS5zZ3dojUwNBnub8jWEIKVU2eP/FnI\nv9od85BVYTj5/uF+JyL2xyBwSw==\n-----END PRIVATE KEY-----\n"
   GOOGLE_SHEETS_SPREADSHEET_ID=1HyLLJ_e4QtSzHohvjoaD4HmsNMhUkE2V4g2NaBjB7YM
   ```

   **Important Notes:**
   - The `GOOGLE_PRIVATE_KEY` should be a single line with actual newlines replaced by `\n`
   - The private key should start with `-----BEGIN PRIVATE KEY-----` and end with `-----END PRIVATE KEY-----`
   - Keep your `.env` file secure and never commit it to version control

## Google Sheets Setup

1. **Create a Google Cloud Project and Enable APIs**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create a new project
   - Enable the **Google Sheets API**
   - Go to "APIs & Services" > "Credentials"
   - Click "Create Credentials" > "Service account"
   - Fill in the service account details and click "Create"
   - Grant the service account the "Editor" role
   - Click "Done"
   - Find your service account in the list and click on it
   - Go to the "Keys" tab
   - Click "Add Key" > "Create new key"
   - Select JSON and click "Create" - this will download a JSON key file

2. **Configure Environment Variables**
   - Open the downloaded JSON key file
   - Copy the `client_email` value to `GOOGLE_SERVICE_ACCOUNT_EMAIL` in `.env`
   - Copy the `private_key` value to `GOOGLE_PRIVATE_KEY` in `.env`
     - Ensure you preserve the newlines by replacing them with `\n`
     Example:
     ```
     GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w...\n...\n-----END PRIVATE KEY-----\n"
     ```
   - Set `GOOGLE_SHEETS_SPREADSHEET_ID` to your Google Sheet ID

3. **Share Your Google Sheet**
   - Open your Google Sheet
   - Click "Share" in the top-right corner
   - Add your service account email (from `client_email`)
   - Grant "Editor" permissions

4. **Sheet Structure**
   Create two sheets with the following structure:

   **products_processed** (Sheet 1):
   ```
   | id  | title       | description      | brand    | category | price | in_stock |
   |-----|-------------|------------------|----------|-----------|-------|----------|
   | 1   | Sample Item | Description here | Brand    | Category  | 19.99 | true     |
   ```

   **product_photos** (Sheet 2):
   ```
   | product_id | filename.jpg | is_main | order |
   |------------|--------------|---------|-------|
   | 1          | image1.jpg   | true    | 1     |
   | 1          | image2.jpg   | false   | 2     |
   ```

5. **Product Images**
   Place your product images in the following structure:
   ```
   public/
     images/
       {product_id}/
         image1.jpg
         image2.jpg
         ...
   ```
   The filenames should match those in the `product_photos` sheet.

## Running the Server

1. Start the development server:
   ```bash
   npm run dev
   ```

2. The server will be available at `http://localhost:3000`

## Available Endpoints

### Get Products
- **GET** `/products`
  - Query parameters:
    - `search`: Filter products by search term
    - `category`: Filter by category
    - `brand`: Filter by brand
  - Example: `GET /products?category=electronics&search=phone`

### Get Single Product
- **GET** `/products/:id`
  - Example: `GET /products/1`

### Get User Profile
- **GET** `/profile?telegramUserId=123`

### Update User Profile
- **POST** `/profile`
  - Body: `{ "telegramUserId": "123", ...otherProfileData }`

### Create Order
- **POST** `/orders`
  - Body:
    ```json
    {
      "items": [
        { "productId": "1", "quantity": 2 }
      ],
      "address": {
        "street": "123 Main St",
        "city": "City",
        "country": "Country"
      },
      "telegramUser": {
        "id": 123456789,
        "first_name": "John",
        "last_name": "Doe",
        "username": "johndoe"
      }
    }
    ```

## Data Conversion (Optional)

If you need to convert your existing data to the required format, you can create a script in the `scripts` directory. Here's an example for CSV conversion:

```javascript
// scripts/convert-products.js
const fs = require('fs').promises;
const csv = require('csv-parser');
const { createReadStream } = require('fs');

async function convertProducts() {
  const results = [];
  
  await new Promise((resolve, reject) => {
    createReadStream('path/to/your/products.csv')
      .pipe(csv())
      .on('data', (data) => results.push({
        id: data.id,
        title: data.name,
        brand: data.brand,
        category: data.category,
        price: parseFloat(data.price),
        description: data.description,
        inStock: data.stock > 0
      }))
      .on('end', resolve)
      .on('error', reject);
  });

  await fs.writeFile('src/data/products.json', JSON.stringify(results, null, 2));
  console.log('Products converted successfully!');
}

convertProducts().catch(console.error);
```

## Deployment

For production deployment, you can use services like:
- Railway
- Render
- Heroku
- Vercel (with serverless functions)

Make sure to set the environment variables in your hosting platform's configuration.
