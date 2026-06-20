Thực hiện yêu cầu sau: 
Sửa giao diện trang web: 
* Trang sử dụng tiếng Anh. 
* Bàn cờ sử dụng trong /src/assets/chess/chessboard/default.png
* Quân cờ phải kéo được chứ không phải chỉ click vào ô nguồn rồi click vào ô đích.
* Các ô cờ phải đều nhau, tránh tình trạng ô có quân cờ bị to hơn các ô khác.
* Các chỉ số 1, 2, 3, 4, 5, 6, 7, 8 và a, b, c, d, e, f, g, h chỉ nằm ở ngoài biên của bàn cờ (1 bên dưới và 1 bên trái, chỉ số nhỏ nằm ở góc dưới bên trái đối với cột a-h và phía trên bên trái đối với hàng 1-8).
* Phần biên bản có 2 cột, cột thức nhất là nước đi của quân trắng, cột thứ 2 là nước đi của quân đen, mỗi hàng thể hiện 1 nước đi của cả 2 quân. Lần lượng nước thứ nhất trắng rồi tới đen, nước thứ 2 trắng rồi tới đen, ...
* Hiển thị elo của 2 kì thủ bên cạnh tên của họ.
* Thông bào của trang web phải thông báo dạng toast ở góc dưới bên phải. Gồm các loại Success, Error, Warning, Info.

Thêm các chức năng trang web: 
* Thêm nút "Draw" (hòa cờ) ở góc trên bên phải của bàn cờ. Khi người chơi click vào nút này, hệ thống sẽ gửi yêu cầu hòa cờ đến đối thủ. Đối thủ có thể chấp nhận hoặc từ chối yêu cầu hòa cờ. Nếu đối thủ chấp nhận yêu cầu hòa cờ, ván cờ sẽ kết thúc với kết quả hòa. Nếu đối thủ từ chối yêu cầu hòa cờ, ván cờ sẽ tiếp tục. Có comfirm trước khi gửi yêu cầu hòa cờ.
* Thêm nút "Resign" (đầu hàng) ở góc trên bên phải của bàn cờ. Nút này chỉ hiển thị khi ván cờ đã đi được từ 3 nước trở lên. Khi người chơi click vào nút này, hệ thống sẽ gửi yêu cầu đầu hàng đến đối thủ. Đối thủ có thể chấp nhận hoặc từ chối yêu cầu đầu hàng. Nếu đối thủ chấp nhận yêu cầu đầu hàng, ván cờ sẽ kết thúc với kết quả đối thủ thắng. Nếu đối thủ từ chối yêu cầu đầu hàng, ván cờ sẽ tiếp tục. Có comfirm trước khi gửi yêu cầu đầu hàng.
* Thêm nút "Abort" (hủy ván cờ) ở góc trên bên phải của bàn cờ. Nút này chỉ hiển thị khi ván cò chỉ đi được dưới 3 nước (tức là nước 1 trắng, nước 1 đen, nước 2 trắng). Khi người chơi click vào nút này, hệ thống sẽ hủy ván cờ ngay lập tức (có comfirm). Khi đá đánh từ 3 nước trở lên thì không cho hủy ván cờ nữa, thay vào đó nút này được thay bằng nút "Resign".

Elo tính theo như sau: 
Giả thiết, bàn cờ 2 đối thủ A & B thi đấu với nhau, trong đó:
- Kỳ thủ A có điểm số Elo: Ra
- Kỳ thủ B có điểm số Elo: Rb

- Công thức (1) – tính cho người chơi A: Ea=Qa/(Qa+Qb)
- Công thức (2) – tính cho người chơi B: Eb=Qb/(Qa+Qb)

trong đó:
- Qa=10^(Ra/400)
- Qb= 10^(Rb/400)

Chú ý: Ea + Eb = 1

Điểm trận đấu của kỳ thủ:

Khi hết ván
+ Thắng: được 1 điểm
+ Hòa: được 0.5 điểm
+ Thua: được 0 điểm

Công thức điều chỉnh Elo được tính lại sau khi kết thúc mỗi ván đấu, như sau:
Người A: Ra’ = Ra + K(Aa – Ea)
Người B: Rb’ = Rb + K(Ab – Eb)

Trong đó Aa và Ab lần lượt là điểm trận đấu của hai kỳ thủ và K là một hệ số có tác dụng kiểm soát hiện tượng lạm phát và giảm phát.

- Hệ số K
+ K = 25 dành cho kỳ thủ mới có cường số dưới 1600
+ K = 20 dành cho kỳ thủ mới có cường số dưới 2000
+ K = 15 dành cho kỳ thủ có cường số dưới 2400.
+ K = 10 dành cho kỳ thủ có cường số trên 2400

Thêm chức năng cộng trừ elo của các kì thủ theo công thức trên sau khi kết thúc ván cờ. Nếu ván cờ bị hủy thì không cộng trừ elo.

Thêm các chức năng mới, chỉnh sửa các chức năng:
* Thêm chức năng xem lại ván cờ: khi xem lại lịch sử của người chơi có hiển thị danh sách các ván cờ. Danh sách này hiển thị ai là quân trắng, ai là quân đen, elo của từng người khi bắt đầu ván cờ, kết quả ván cờ, lý do kết thúc ván cờ. Thêm thuộc tính "playerBlackElo" và "playerWhiteElo" vào bảng game (tức là elo của 2 kì thủ khi bắt đầu ván cờ). Khi ấn vào "Detail" thì sẽ hiện ra giao diện xem lại ván cờ, giao diện này giống hệt giao diện chơi cờ, nhưng không cho phép người chơi đi cờ, chỉ cho phép người chơi xem lại ván cờ. Trong giao diện xem lại ván cờ có các nút điều hướng để xem lại các nước đi của ván cờ. Các nút điều hướng bao gồm: nút "First" để xem nước đi đầu tiên, nút "Previous" để xem nước đi trước đó, nút "Next" để xem nước đi tiếp theo, nút "Last" để xem nước đi cuối cùng. Các nút được hiển thị là mũi tên đơn và kép.
* Ở bước xác thực email khi đăng kí, link phải có dạng click vào sẽ chuyển trên trang web và tự động xác thực email (link phải bắt đầu bằng https://localhost:5173/verify-email?token=..., là link web, không phải link backend. Từ web mới gọi api của backend để xác thực email). Nếu xác thực thành công thì hiển thị trang xác thực thành công, nếu xác thực thất bại thì hiển thị trang xác thực thất bại. Chỉ sửa backend nều cần thiết.
* Dữ liệu danh sách các trận đấu của 1 kì thủ phải được trả về dưới dạng phân trang (mỗi trang mặc định 10 trận đấu, có các giá trị khác là 10, 20, 50, 100). Chỉnh sửa chức năng này ở cả backend và web.

Khi code có thể thay đổi cả chess-64-squares-web và chess-64-squares-backend.
