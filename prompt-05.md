Thực hiện các yêu cầu sau:
* Chỉnh sửa giao diện "chess-64-squares-web" như sau:
    - Cứ mỗi khi load trang thì phải đăng nhập lại. Tôi muốn khi tải lại trang thì vẫn là user đó.
    - Model thông báo kết thúc trận có 4 nút là xác nhận, yêu cầu chơi lại, xem lịch sử và tìm trận mới.
    - Tôi muốn hiển thị elo khi thắng, thua hoặc hòa cho mỗi player. Các chỉ số này KHÔNG lưu trữ trong database.
    - Giao diện hiện tại bị lệch. Trang "play" chia thành 3 phần từ trái qua phải lần lượt là: 
        + Phần 1: From tìm trận.
        + Phần 2: Thông tin 2 player và bàn cờ.
        + Phần 3: Biên bản nước đi.
    - Các file HistoryPage.tsx, PlayPage.tsx, ProfilePage.tsx, LoginPage.tsx, RegisterPage.tsx, VerifyPage.tsx trong "src/pages" phải được tổ chức lại toàn bộ các thành phần phải của page nào phải nằm trong page đó. KHÔNG ĐƯỢC để mỗi file chỉ có 1 dòng return <>{children}</>. Điều này thật vô lý. Hãy làm lại cho hợp lý.

    
* Chỉnh sửa các chức năng sau:  
    - Trong bảng entity Move có thuộc tính "time_taken" là thời gian thực hiện nước đi đó. Hãy tính toán và lưu trữ thông tin này.
    - Tôi đã loại bỏ 2 thuộc tính playerWhiteEloChange và playerBlackEloChange trong bảng entity Game. Hãy tìm cách để hiển thị elo khi thắng, hòa, thua của mỗi kì thủ trên giao diện mà không cần lưu trữ 2 thuộc tính này.


Khi code có thể thay đổi cả "chess-64-squares-web" và "chess-64-squares-backend" để thực hiện các yêu cầu trên.
Phong cách giao diện dựa vào file "chess-64-squares-web/DESIGN.md"


