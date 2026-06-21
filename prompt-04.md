Thực hiện các yêu cầu sau:
* Chỉnh sửa giao diện "chess-64-squares-web" như sau:
    - Tách các trang profile, game, history (lịch sử của 1 ván cờ), login, register, verify-email ra thành các trang riêng (page). Mỗi trang phải có đường dẫn riêng (/play, /profile, /profile/:username, /history/:gameId, /login, /register, /verify-email).
    - Chỉnh sửa bàn cờ nhỏ lại sao cho hiển thị được 2 phần thông tin player và bàn cờ vừa đủ 1 trang web. Biên bản nước đi ở bên trái nếu vượt quá độ dài màng thì thì cho thêm thanh cuộn.
    - Khi đầu hàng (resign) thì không cần đối thủ xác nhận, chỉ có yêu cầu hòa (draw) thì cần đối thủ xác nhận.
    - Khi ván cờ kết thúc thì hiển thị form thông báo kết quả ván cờ.
    - Comfim dialog được tạo riêng phù hợp với phong cách của web.
    - Thêm thời gian còn lại bên cạch thông tin của 2 player.
    - Sau khi ván cờ kết thúc thì hiển thì lại form tìm trận.
    - Đặc biệt chú ý: Chỉnh sửa bàn cờ dựa theo cách tổ chức giống như trong file "chess-64-squares-web/chess.html". Đảm bảo phải responsive. Đảm bảo có thể thực hiện theo 2 kiểu đi là click vào ô quân cờ và kéo thả quân cờ.

    
* Chỉnh sửa các chức năng sau:  
    - Thêm tính năng tính giờ, giờ được quy định theo game mode vào gồm tổng giờ và thời gian cộng thêm cho mỗi nước đi.


Khi code có thể thay đổi cả "chess-64-squares-web" và "chess-64-squares-backend" để thực hiện các yêu cầu trên.
Phong cách giao diện dựa vào file "chess-64-squares-web/DESIGN.md"


