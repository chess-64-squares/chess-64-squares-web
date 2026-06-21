Thực hiện các yêu cầu sau:
* Chỉnh sửa cấu trúc thư mục trong chess-64-squares-web/src như sau:
    - thư mục "pages" chứa các trang của web
    - thư mục "component" chứa các thành phần riêng lẻ
    - thư mục "service" chứa các service gọi đến backend
    - thư mục "connect" chứ kết nối chung đến backend (đã được tạo)
    - thư mục "context" chứa các context. Trong đó có "authContext" chứa context cho việc xác thực (vẫn chưa hoàn thành hoàn thiện, hãy sửa lại và hoàn thiện nó)
    - thư mục "dto" chứa các dto
    - thư mục "utils" chứa các utils. Trong đó có "dateUtils" chứa các hàm format ngày tháng
    
* Chỉnh sửa các chức năng sau:  
    - Tách project web ra thành các trang riêng (page) theo cấu trúc thư mục như trên
    - GameMode phải được lấy từ backend lên, không được hardcode. Tạo api ở backend để thực hiện chức năng này
    - Bàn cờ hiện đang bị lỗi chỉ có thể kéo thả quân cờ, không thể click để chọn quân cờ để di chuyển (chọn quân cờ rồi chọn ô muốn di chuyển đến). Tô muốn thực hiện được cả 2 cách di chuyển
    - Thêm 2 thuộc tính "playerWhiteEloChange" và "playerBlackEloChange" vào entity "Game" và hiển thị trên cả giao diện khi thi đấu và lịch sử ván cờ.
    - jwt được lưu trong localStorage. Đảm bảo không mất khi đóng tab
    - Trên giao diện phải có hiệu ứng loading khi tìm trận đấu. Khi tìm thấy trận đấu thì form tìm kiếm (các GameMode phải ẩn đi).
    - Chuyển thông tin của 2 player sang phía trên và phía dưới của bàn cờ. Khi chưa tìm thấy trận thì để trống thông tin của 2 player. Khi tìm thấy trận thì hiển thị thông tin của 2 player.

Khi code có thể thay đổi cả chess-64-squares-web và chess-64-squares-backend để thực hiện các yêu cầu trên.