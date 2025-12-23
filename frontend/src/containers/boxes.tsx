import { QueryCache } from "@tanstack/react-query";
import { Divider } from "antd";
import { Link } from "react-router-dom";

function Boxes() {
  // eslint-disable-next-line prettier/prettier
  const queryCache = new QueryCache();

  const query = queryCache.findAll(["user-info"]);

  console.log(query);
  const itemClass = [
    "w-full h-16 border-2 flex gap-3 border-[var(--tg-theme-button-color)]",
    "border-opacity-80 items-center justify-center rounded-lg"
  ].join(" ");
  return (
    <div className="flex w-full flex-col gap-3 ">
      <Divider className="my-0 p-0">Меню</Divider>
      <div className="grid grid-cols-2 grid-rows-2 gap-2 ">
        <Link className={`${itemClass} col-span-2 `} to="/profile/orders">
          Мои заказы
          <span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              className="h-6 w-6">
              <path d="M4 20h2V10a1 1 0 0 1 1-1h12V7a1 1 0 0 0-1-1h-3.051c-.252-2.244-2.139-4-4.449-4S6.303 3.756 6.051 6H3a1 1 0 0 0-1 1v11a2 2 0 0 0 2 2zm6.5-16c1.207 0 2.218.86 2.45 2h-4.9c.232-1.14 1.243-2 2.45-2z" />
              <path d="M21 11H9a1 1 0 0 0-1 1v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a1 1 0 0 0-1-1zm-6 7c-2.757 0-5-2.243-5-5h2c0 1.654 1.346 3 3 3s3-1.346 3-3h2c0 2.757-2.243 5-5 5z" />
            </svg>
          </span>
        </Link>
      </div>
    </div>
  );
}

export default Boxes;
