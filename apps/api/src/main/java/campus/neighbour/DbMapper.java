package campus.neighbour;

import java.util.*;
import org.apache.ibatis.annotations.*;

/** SQL comes only from application constants. All user values use bound p parameters. */
@Mapper
public interface DbMapper {
  @Select("${sql}")
  List<Map<String, Object>> query(@Param("sql") String sql, @Param("p") Object[] params);

  @Update("${sql}")
  int execute(@Param("sql") String sql, @Param("p") Object[] params);
}
